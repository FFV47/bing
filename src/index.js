import { readFileSync } from "node:fs";
import puppeteer from "puppeteer";
import { config } from "./config.js";
import { SEARCH_TERMS_PATH } from "./generateTermsGemini.js";

/** @type {import('puppeteer').Browser | null} */
let browser = null;

/** @type {import('puppeteer').Page | null} */
let page = null;

try {
  await main();
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}

/**
 * Main function that runs the auto-search loop
 */
async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║       Bing Auto-Search Application         ║");
  console.log("╚════════════════════════════════════════════╝\n");

  console.log("Configuration:");
  console.log(`  • Interval: ${formatInterval(config.minIntervalMs)} - ${formatInterval(config.maxIntervalMs)}`);
  // console.log(`  • Search terms: ${config.searchTerms.length} terms loaded`);
  console.log(`  • Typing delay: ${config.typingDelayMs}ms per character`);
  console.log(`  • Max searches: ${config.maxSearches === 0 ? "Unlimited" : config.maxSearches}`);
  console.log("\nPress Ctrl+C to stop the application.\n");
  console.log("─".repeat(50) + "\n");

  const searchTerms = JSON.parse(readFileSync(SEARCH_TERMS_PATH, "utf-8").toString());

  // Initialize the browser
  await initBrowser();

  let searchCount = 0;
  let termIndex = 0;
  let timeoutId = null;
  let isRunning = true;
  let countdownIntervalId = null;

  // Perform initial search immediately
  const { term: initialTerm, nextIndex: newIndex } = getSearchTerm(searchTerms, termIndex);
  termIndex = newIndex;
  try {
    await performSearch(initialTerm);
    searchCount++;
  } catch {
    console.log("\nSearch failed. Shutting down...");
    await closeBrowser();
    process.exit(1);
  }

  // Schedule the next search
  void scheduleNextSearch();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\nShutting down...");
    console.log(`Total searches performed: ${searchCount}`);
    isRunning = false;
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    if (timeoutId) clearTimeout(timeoutId);
    await closeBrowser();
    process.exit(0);
  });

  /**
   * Starts a countdown timer that updates every second
   * @param {number} totalMs - Total milliseconds to count down
   */
  function startCountdown(totalMs) {
    let remainingMs = totalMs;

    // Clear any existing countdown
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
    }

    // Update countdown every second
    countdownIntervalId = setInterval(() => {
      if (remainingMs <= 0) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        // process.stdout.write("\r" + " ".repeat(60) + "\r");
        process.stdout.write("\r");
        return;
      }

      process.stdout.write(`\r⏱  Next search in: ${formatInterval(remainingMs)}   `);
      remainingMs -= 1000;
    }, 1000);

    console.log("");
  }

  /**
   * Schedules the next search with a random interval
   */
  async function scheduleNextSearch() {
    if (!isRunning) return;

    // Check if we've reached the maximum number of searches
    if (config.maxSearches > 0 && searchCount >= config.maxSearches) {
      console.log(`\nReached maximum number of searches (${config.maxSearches}). Stopping...`);
      await closeBrowser();
      process.exit(0);
    }

    const nextInterval = getRandomInterval();
    console.log(`Total searches performed: ${searchCount}`);
    // console.log(`Next search in: ${formatInterval(nextInterval)}\n`);
    // console.log("─".repeat(50) + "\n");

    // Start the countdown display
    startCountdown(nextInterval);

    timeoutId = setTimeout(async () => {
      // Stop the countdown before performing search
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        // process.stdout.write("\r" + " ".repeat(60) + "\r");
        process.stdout.write("\r");
      }

      const { term, nextIndex } = getSearchTerm(searchTerms, termIndex);
      termIndex = nextIndex;
      try {
        await performSearch(term);
        searchCount++;
        await scheduleNextSearch();
      } catch {
        console.log("\nSearch failed. Shutting down...");
        console.log(`Total searches performed: ${searchCount}`);
        await closeBrowser();
        process.exit(1);
      }
    }, nextInterval);
  }
}

/**
 * Initializes the browser instance by connecting to an existing Chrome
 * @returns {Promise<void>}
 */
async function initBrowser() {
  const debugUrl = `http://127.0.0.1:${config.chromeDebugPort}`;

  console.log("Connecting to existing Chrome instance...");
  console.log(`Debug URL: ${debugUrl}`);

  try {
    browser = await puppeteer.connect({
      browserURL: debugUrl,
      defaultViewport: null,
    });

    // Create a new tab for our searches
    page = await browser.newPage();
    console.log("✓ Connected to Chrome successfully!\n");
  } catch {
    console.error("✗ Failed to connect to Chrome.");
    console.error("");
    console.error("  Please start Chrome with remote debugging:");
    console.error(`  google-chrome --remote-debugging-port=${config.chromeDebugPort}`);
    console.error("");
    process.exit(1);
  }
}

/**
 * Disconnects from the browser gracefully (does not close Chrome)
 * @returns {Promise<void>}
 */
async function closeBrowser() {
  if (page) {
    try {
      await page.close(); // Close only the tab we created
    } catch {
      // Page might already be closed
    }
    page = null;
  }
  if (browser) {
    await browser.disconnect(); // Disconnect without closing Chrome
    browser = null;
  }
}

/**
 * Gets a random interval between min and max configured values
 * @returns {number} Random interval in milliseconds
 */
function getRandomInterval() {
  const { minIntervalMs, maxIntervalMs } = config;
  return Math.floor(Math.random() * (maxIntervalMs - minIntervalMs + 1)) + minIntervalMs;
}

/**
 * Gets the next search term based on configuration
 * @param {string[]} terms - Array of search terms
 * @param {number} index - Current index in the search terms array
 * @returns {{ term: string, nextIndex: number }} The search term and next index
 */
function getSearchTerm(terms, index) {
  const term = terms[index % terms.length];
  return { term, nextIndex: index + 1 };
}

/**
 * Slowly scrolls the page to a target position
 * @param {number} targetY - Target scroll position
 * @param {number} duration - Duration in milliseconds
 * @returns {Promise<void>}
 */
async function smoothScroll(targetY, duration) {
  if (!page) return;

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
 * Gets the maximum scroll height of the page
 * @returns {Promise<number>}
 */
async function getMaxScrollHeight() {
  if (!page) return 0;

  return await page.evaluate(() => {
    return document.documentElement.scrollHeight - window.innerHeight;
  });
}

/**
 * Performs a Bing search by typing in the search box and clicking search
 * @param {string} query - The search query
 * @returns {Promise<void>}
 */
async function performSearch(query) {
  if (!page) {
    throw new Error("Browser page not initialized");
  }

  console.log(`[${new Date().toLocaleTimeString()}] Searching for: "${query}"`);

  try {
    // Navigate to Bing
    console.log("  → Navigating to Bing...");
    await page.goto(config.bingBaseUrl, { waitUntil: "networkidle2" });

    // Wait for and clear the search box
    console.log("  → Finding search box...");
    const searchBoxSelector = "#sb_form_q";
    await page.waitForSelector(searchBoxSelector, { timeout: 10000 });

    // Clear any existing text in the search box
    await page.click(searchBoxSelector, { clickCount: 3 });
    await page.keyboard.press("Backspace");

    // Type the search query with a human-like delay
    console.log(`  → Typing: "${query}"...`);
    await page.type(searchBoxSelector, query, { delay: config.typingDelayMs });

    // Small pause before searching
    console.log("  → Waiting 2 seconds before searching...");
    await sleep(2000);

    // Press Enter to search
    console.log("  → Pressing Enter to search...");
    await page.keyboard.press("Enter");

    // Wait for results to load
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });

    console.log("  → Waiting 10 seconds before scrolling...");
    await sleep(10000);

    // Slowly scroll to the bottom of the page
    console.log("  → Scrolling to bottom of page...");
    const maxScroll = await getMaxScrollHeight();
    await smoothScroll(maxScroll, 20000);

    // Wait 2 seconds at the bottom
    console.log("  → Waiting 2 seconds...");
    await sleep(2000);

    // Slowly scroll back to the top
    console.log("  → Scrolling back to top...");
    await smoothScroll(0, 3000);

    console.log("  ✓ Search completed successfully!\n");
  } catch (error) {
    // @ts-ignore
    console.error(`  ✗ Search failed: ${error.message}\n`);
    throw error;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats milliseconds into a human-readable string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
function formatInterval(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} hour(s) ${minutes % 60} minute(s)`;
  }
  if (minutes > 0) {
    return `${minutes} minute(s) ${seconds % 60} second(s)`;
  }
  return `${seconds} second(s)`;
}
