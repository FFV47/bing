import { config } from "./config.js";
import { getPage, isBrowserConnected, reconnectBrowser } from "./browser.js";
import { sleep } from "./utils.js";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Performs a search with retry logic - reconnects to Chrome if disconnected
 * @param {string} query - The search query
 * @returns {Promise<boolean>} True if search was successful
 */
export async function performSearchWithRetry(query) {
  let attempt;

  for (attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      // Check if browser is connected before attempting search
      if (!isBrowserConnected()) {
        const reconnected = await retryReconnect();
        if (!reconnected) {
          continue; // Retry reconnection on next attempt
        }
      }

      await performSearch(query);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`✗ Error during search: ${errorMessage}\n\n`);
      const isDisconnectedError =
        errorMessage.includes("Protocol error") ||
        errorMessage.includes("Target closed") ||
        errorMessage.includes("Session closed") ||
        errorMessage.includes("Connection closed") ||
        errorMessage.includes("Browser page not initialized") ||
        !isBrowserConnected();

      if (isDisconnectedError && attempt < MAX_RETRY_ATTEMPTS) {
        await retryReconnect();
        continue; // Retry search on next attempt
      }

      console.log(`✗ Search failed (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}): ${errorMessage}`);
      if (attempt < MAX_RETRY_ATTEMPTS) {
        console.log(`→ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  return false;

  // Internal functions
  async function retryReconnect() {
    console.log(`→ Chrome appears to be closed or disconnected.`);
    console.log(`→ Attempting to reconnect and retry... (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`);

    const reconnected = await reconnectBrowser(RETRY_DELAY_MS);
    if (!reconnected) {
      console.log(`✗ Reconnection failed (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`);
      if (attempt < MAX_RETRY_ATTEMPTS) {
        console.log(`→ Waiting ${RETRY_DELAY_MS / 1000} seconds before next attempt...`);
        await sleep(RETRY_DELAY_MS);
      }
    }

    return reconnected;
  }
}

/**
 * Slowly scrolls the page to a target position
 * @param {import('puppeteer').Page} page - The page instance
 * @param {number} targetY - Target scroll position
 * @param {number} duration - Duration in milliseconds
 * @returns {Promise<void>}
 */
async function smoothScroll(page, targetY, duration) {
  await page.evaluate(
    async (target, dur) => {
      const startY = window.scrollY;
      const distance = target - startY;
      const startTime = performance.now();

      return new Promise((resolve) => {
        function step() {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / dur, 1);

          // Ease in-out function for smooth scrolling
          const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          window.scrollTo(0, startY + distance * easeProgress);

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            // @ts-ignore
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    },
    targetY,
    duration
  );
}

/**
 * Performs a Bing search by typing in the search box and clicking search
 * @param {string} query - The search query
 * @returns {Promise<void>}
 */
async function performSearch(query) {
  const page = getPage();

  if (!page) {
    throw new Error("Browser page not initialized");
  }

  console.log(`[${new Date().toLocaleTimeString()}] Searching for: "${query}"`);

  try {
    // Navigate to Bing
    console.log("→ Navigating to Bing...");
    await page.goto(config.bingBaseUrl, { waitUntil: "networkidle2" });

    // Wait for and clear the search box
    console.log("→ Finding search box...");
    const searchBoxSelector = "#sb_form_q";
    await page.waitForSelector(searchBoxSelector, { timeout: 10000 });

    // Clear any existing text in the search box
    await page.click(searchBoxSelector, { clickCount: 3 });
    await page.keyboard.press("Backspace");

    // Type the search query with a human-like delay
    console.log(`→ Typing: "${query}"...`);
    await page.type(searchBoxSelector, query, { delay: config.typingDelayMs });

    // Small pause before searching
    console.log("→ Waiting 2 seconds before searching...");
    await sleep(2000);

    // Press Enter to search
    console.log("→ Pressing Enter to search...");
    await page.keyboard.press("Enter");

    // Wait for results to load
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });

    console.log("→ Waiting 10 seconds before scrolling...");
    await sleep(10000);

    // Slowly scroll to the bottom of the page
    console.log("→ Scrolling to bottom of page...");
    const maxScroll = await getMaxScrollHeight(page);
    await smoothScroll(page, maxScroll, 20000);

    // Wait 2 seconds at the bottom
    console.log("→ Waiting 2 seconds...");
    await sleep(2000);

    // Slowly scroll back to the top
    console.log("→ Scrolling back to top...");
    await smoothScroll(page, 0, 3000);

    console.log("→ Search completed successfully!\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`→ Search failed: ${errorMessage}\n`);
    throw error;
  }

  /**
   * Gets the maximum scroll height of the page
   * @param {import('puppeteer').Page} page - The page instance
   * @returns {Promise<number>}
   */
  async function getMaxScrollHeight(page) {
    return await page.evaluate(() => {
      return document.documentElement.scrollHeight - window.innerHeight;
    });
  }
}
/**
 * Gets the next search term based on configuration
 * @param {string[]} terms - Array of search terms
 * @param {number} index - Current index in the search terms array
 * @returns {{ term: string, nextIndex: number }} The search term and next index
 */

export function getSearchTerm(terms, index) {
  const term = terms[index % terms.length];
  return { term, nextIndex: index + 1 };
}
