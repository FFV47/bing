import { getPage, isBrowserConnected, reconnectBrowser } from "./browser.js";
import { config } from "./config.js";
import { createAbortError, getRandomBetween, isAbortError, sleep } from "./utils.js";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;
const SEARCH_BOX_SELECTOR = "#sb_form_q";
const COOKIE_ACCEPT_SELECTOR = "#bnp_btn_accept";

/**
 * @typedef {object} SearchDependencies
 * @property {() => import("puppeteer-core").Page | null} [getPage]
 * @property {() => boolean} [isBrowserConnected]
 * @property {(retryDelayMs: number, options?: { signal?: AbortSignal }) => Promise<boolean>} [reconnectBrowser]
 * @property {import("./config.js").AppConfig} [cfg]
 * @property {typeof sleep} [sleepFn]
 * @property {typeof getRandomBetween} [randomBetween]
 */

/**
 * Determines whether an error indicates a broken CDP/browser connection
 * rather than a transient page or network timeout.
 *
 * @param {unknown} error
 * @param {boolean} connected
 * @returns {boolean}
 */
export function isDisconnectedError(error, connected) {
  if (!connected) {
    return true;
  }

  const errorName = error instanceof Error ? error.name : "";
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    errorName === "ProtocolError" ||
    errorMessage.includes("Protocol error") ||
    errorMessage.includes("protocolTimeout") ||
    errorMessage.includes("Target closed") ||
    errorMessage.includes("Session closed") ||
    errorMessage.includes("Connection closed") ||
    errorMessage.includes("Execution context was destroyed") ||
    errorMessage.includes("Browser page not initialized")
  );
}

/**
 * Performs a search with retry logic — reconnects to Chrome if disconnected.
 *
 * @param {string} query - The search query
 * @param {{
 *   signal?: AbortSignal,
 *   maxAttempts?: number,
 *   retryDelayMs?: number,
 *   deps?: SearchDependencies,
 * }} [options]
 * @returns {Promise<boolean>} True if search was successful
 */
export async function performSearchWithRetry(query, options = {}) {
  const { signal, maxAttempts = MAX_RETRY_ATTEMPTS, retryDelayMs = RETRY_DELAY_MS, deps = {} } = options;

  const checkConnected = deps.isBrowserConnected ?? isBrowserConnected;
  const reconnect = deps.reconnectBrowser ?? reconnectBrowser;
  const sleepFn = deps.sleepFn ?? sleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    try {
      if (!checkConnected()) {
        const reconnected = await attemptReconnect(attempt);
        if (!reconnected) {
          continue;
        }
      }

      await performSearch(query, { signal, deps });
      return true;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw createAbortError();
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const disconnected = isDisconnectedError(error, checkConnected());

      console.error(`✗ Search failed (attempt ${attempt}/${maxAttempts}): ${errorMessage}`);

      if (attempt >= maxAttempts) {
        break;
      }

      if (disconnected) {
        await attemptReconnect(attempt);
        continue;
      }

      console.log(`→ Retrying in ${retryDelayMs / 1000} seconds...`);
      await sleepFn(retryDelayMs, { signal });
    }
  }

  return false;

  /**
   * @param {number} attempt
   * @returns {Promise<boolean>}
   */
  async function attemptReconnect(attempt) {
    console.log("→ Chrome appears to be closed or disconnected.");
    console.log(`→ Attempting to reconnect and retry... (attempt ${attempt}/${maxAttempts})`);

    const reconnected = await reconnect(retryDelayMs, { signal });
    if (!reconnected) {
      console.error(`✗ Reconnection failed (attempt ${attempt}/${maxAttempts})`);
    }
    return reconnected;
  }
}

/**
 * Slowly scrolls the page to a target position.
 * Uses wall-clock timing with a timer fallback so scrolling still completes
 * when `requestAnimationFrame` is throttled or paused (e.g., Wayland screen off).
 *
 * @param {import("puppeteer-core").Page} page - The page instance
 * @param {number} targetY - Target scroll position
 * @param {number} duration - Duration in milliseconds
 * @returns {Promise<void>}
 */
async function smoothScroll(page, targetY, duration) {
  await page.evaluate(
    (target, dur) => {
      const startY = window.scrollY;
      const distance = target - startY;

      if (Math.abs(distance) <= 1 || dur <= 0) {
        window.scrollTo(0, target);
        return Promise.resolve();
      }

      const startTime = Date.now();
      const maxWaitMs = dur + 2_000;

      return /** @type {Promise<void>} */ (
        new Promise((resolve) => {
          let settled = false;
          /** @type {number | null} */
          let fallbackTimer = null;

          const finish = () => {
            if (settled) return;
            settled = true;
            if (fallbackTimer !== null) {
              window.clearTimeout(fallbackTimer);
              fallbackTimer = null;
            }
            window.scrollTo(0, target);
            resolve(undefined);
          };

          const safetyTimer = window.setTimeout(finish, maxWaitMs);

          const scheduleNext = () => {
            if (settled) return;
            if (document.hidden) {
              fallbackTimer = window.setTimeout(step, 100);
            } else {
              // Watchdog in case rAF is paused while document.hidden stays false
              fallbackTimer = window.setTimeout(step, 250);
              requestAnimationFrame(step);
            }
          };

          function step() {
            if (settled) return;
            if (fallbackTimer !== null) {
              window.clearTimeout(fallbackTimer);
              fallbackTimer = null;
            }

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / dur, 1);
            const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.scrollTo(0, startY + distance * easeProgress);

            if (progress < 1) {
              scheduleNext();
            } else {
              window.clearTimeout(safetyTimer);
              finish();
            }
          }

          scheduleNext();
        })
      );
    },
    targetY,
    duration
  );
}

/**
 * Dismisses the Bing cookie consent banner if visible.
 * @param {import("puppeteer-core").Page} page
 * @returns {Promise<void>}
 */
async function dismissCookieBanner(page) {
  try {
    const acceptButton = await page.$(COOKIE_ACCEPT_SELECTOR);
    if (acceptButton) {
      await acceptButton.click();
    }
  } catch {
    // Banner absent or already dismissed
  }
}

/**
 * Types text with randomized per-keystroke jitter to simulate human typing.
 *
 * @param {import("puppeteer-core").Page} page
 * @param {string} text
 * @param {number} baseDelayMs
 * @param {number} jitterMs
 * @param {typeof sleep} sleepFn
 * @param {typeof getRandomBetween} randomBetween
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
async function typeWithHumanDelay(page, text, baseDelayMs, jitterMs, sleepFn, randomBetween, signal) {
  if (baseDelayMs <= 0) {
    await page.keyboard.type(text);
    return;
  }

  for (const char of text) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    await page.keyboard.type(char);
    const minDelay = Math.max(20, baseDelayMs - jitterMs);
    const maxDelay = baseDelayMs + jitterMs;
    const delay = randomBetween(minDelay, maxDelay);
    await sleepFn(delay, { signal, silent: true });
  }
}

/**
 * Gets the maximum scroll height of the page.
 * @param {import("puppeteer-core").Page} page - The page instance
 * @returns {Promise<number>}
 */
async function getMaxScrollHeight(page) {
  return await page.evaluate(() => {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  });
}

/**
 * Performs a Bing search by typing in the search box and pressing Enter.
 *
 * @param {string} query - The search query
 * @param {{ signal?: AbortSignal, deps?: SearchDependencies }} [options]
 * @returns {Promise<void>}
 */
export async function performSearch(query, options = {}) {
  const { signal, deps = {} } = options;
  const resolvePage = deps.getPage ?? getPage;
  const cfg = deps.cfg ?? config;
  const sleepFn = deps.sleepFn ?? sleep;
  const randomBetween = deps.randomBetween ?? getRandomBetween;

  const page = resolvePage();
  if (!page) {
    throw new Error("Browser page not initialized");
  }

  console.log(`[${new Date().toLocaleTimeString()}] Searching for: "${query}"`);

  // Navigate to Bing
  console.log("→ Navigating to Bing...");
  await page.goto(cfg.bingBaseUrl, { waitUntil: "networkidle2" });
  await dismissCookieBanner(page);

  // Wait for the search box to be visible and focus it
  console.log("→ Finding search box...");
  await page.waitForSelector(SEARCH_BOX_SELECTOR, { visible: true, timeout: 10_000 });
  await page.click(SEARCH_BOX_SELECTOR);

  // Clear any existing text reliably with Ctrl+A + Backspace
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");

  // Type the search query with randomized human-like delay
  console.log(`→ Typing: "${query}"...`);
  await typeWithHumanDelay(page, query, cfg.typingDelayMs, cfg.behavior.typingJitterMs, sleepFn, randomBetween, signal);

  // Brief randomized pause before submitting
  const preSubmitDelay = randomBetween(cfg.behavior.preSubmitDelayMs.min, cfg.behavior.preSubmitDelayMs.max);
  console.log(`→ Waiting ${(preSubmitDelay / 1000).toFixed(1)}s before searching...`);
  await sleepFn(preSubmitDelay, { signal });

  // Register navigation waiter before pressing Enter to avoid race conditions
  console.log("→ Pressing Enter to search...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 }),
    page.keyboard.press("Enter"),
  ]);

  const preScrollDelay = randomBetween(cfg.behavior.preScrollDelayMs.min, cfg.behavior.preScrollDelayMs.max);
  console.log(`→ Waiting ${(preScrollDelay / 1000).toFixed(1)}s before scrolling...`);
  await sleepFn(preScrollDelay, { signal });

  // Slowly scroll down and back up when the page is scrollable
  const maxScroll = await getMaxScrollHeight(page);
  if (maxScroll > 0) {
    const scrollDownDuration = randomBetween(
      cfg.behavior.scrollDownDurationMs.min,
      cfg.behavior.scrollDownDurationMs.max
    );
    console.log("→ Scrolling to bottom of page...");
    await smoothScroll(page, maxScroll, scrollDownDuration);

    const bottomPause = randomBetween(cfg.behavior.bottomPauseMs.min, cfg.behavior.bottomPauseMs.max);
    console.log(`→ Waiting ${(bottomPause / 1000).toFixed(1)}s...`);
    await sleepFn(bottomPause, { signal });

    const scrollUpDuration = randomBetween(cfg.behavior.scrollUpDurationMs.min, cfg.behavior.scrollUpDurationMs.max);
    console.log("→ Scrolling back to top...");
    await smoothScroll(page, 0, scrollUpDuration);
  }

  console.log("→ Search completed successfully!\n");
}

/**
 * Gets the next search term from the list.
 *
 * @param {string[]} terms - Non-empty array of search terms
 * @param {number} index - Current index in the search terms array
 * @returns {{ term: string, nextIndex: number, wrapped: boolean }} The search term, next index, and wrap indicator
 */
export function getSearchTerm(terms, index) {
  if (!Array.isArray(terms) || terms.length === 0) {
    throw new Error("Search terms list must be a non-empty array");
  }

  const term = terms[index % terms.length];
  return {
    term,
    nextIndex: index + 1,
    wrapped: index >= terms.length,
  };
}
