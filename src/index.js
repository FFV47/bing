import { readFileSync } from "node:fs";
import { config } from "./config.js";
import { SEARCH_TERMS_PATH } from "./generateTermsGemini.js";
import { initBrowser, closeBrowser } from "./browser.js";
import { performSearchWithRetry } from "./search.js";
import { getRandomInterval, formatInterval } from "./utils.js";
import { getSearchTerm } from "./search.js";

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
  console.log(`• Interval: ${formatInterval(config.minIntervalMs)} - ${formatInterval(config.maxIntervalMs)}`);
  console.log(`• Typing delay: ${config.typingDelayMs}ms per character`);
  console.log(`• Max searches: ${config.maxSearches === 0 ? "Unlimited" : config.maxSearches}`);
  console.log("\nPress Ctrl+C to stop the application.\n");
  console.log("─".repeat(50) + "\n");

  const searchTerms = JSON.parse(readFileSync(SEARCH_TERMS_PATH, "utf-8").toString());

  // Initialize the browser
  try {
    await initBrowser();
  } catch {
    console.error("✗ Failed to connect to Chrome.\n");
    console.error("Please start Chrome with remote debugging:");
    console.error(`google-chrome --remote-debugging-port=${config.chromeDebugPort}`);
    process.exit(1);
  }

  let searchCount = 0;
  let termIndex = 0;
  let timeoutId = null;
  let isRunning = true;
  let countdownIntervalId = null;

  // Perform initial search immediately
  const { term: initialTerm, nextIndex: newIndex } = getSearchTerm(searchTerms, termIndex);
  termIndex = newIndex;
  const initialSuccess = await performSearchWithRetry(initialTerm);
  if (initialSuccess) {
    searchCount++;
  } else {
    console.log("\nSearch failed after all retry attempts. Shutting down...");
    await closeBrowser();
    process.exit(1);
  }

  // Schedule the next search
  await scheduleNextSearch();

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

      process.stdout.write(`\r⏱  Next search in: ${formatInterval(remainingMs)}`);
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

    // Start the countdown display
    startCountdown(nextInterval);

    timeoutId = setTimeout(async () => {
      // Stop the countdown before performing search
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        process.stdout.write("\r");
      }

      const { term, nextIndex } = getSearchTerm(searchTerms, termIndex);
      termIndex = nextIndex;
      const success = await performSearchWithRetry(term);
      if (success) {
        searchCount++;
        await scheduleNextSearch();
      } else {
        console.log("\nSearch failed after all retry attempts. Shutting down...");
        console.log(`Total searches performed: ${searchCount}`);
        await closeBrowser();
        process.exit(1);
      }
    }, nextInterval);
  }
}
