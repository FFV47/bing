import { existsSync, readFileSync } from "node:fs";
import { closeBrowser, initBrowser } from "./browser.js";
import { killExistingChromeDebug, launchChrome } from "./chromeLauncher.js";
import { config } from "./config.js";
import { generateTerms, SEARCH_TERMS_PATH } from "./generateTermsGemini.js";
import { getSearchTerm, performSearchWithRetry } from "./search.js";
import { formatInterval, getRandomInterval, sleep } from "./utils.js";

/**
 * Main CLI entry point
 */
async function main() {
  printBanner();
  printHelp();

  // Step 1: Generate search terms
  console.log("\nStep 1: Generating search terms...\n");
  const termsSuccess = await generateSearchTermsWithRetry();

  if (!termsSuccess) {
    console.error("✗ Failed to generate search terms. Aborting.");
    process.exit(1);
  }

  // Step 2: Launch Chrome
  console.log("\nStep 2: Launching Chrome...\n");
  try {
    await killExistingChromeDebug(config.chromeDebugPort);
    await launchChrome({
      port: config.chromeDebugPort,
      userDataDir: config.chromeUserDataDir,
    });
  } catch (error) {
    console.error("✗ Failed to launch Chrome:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Step 3: Run the search loop
  console.log("\n🔍 Step 3: Starting search automation...\n");
  await runSearchLoop();
}

/**
 * Prints the application banner
 */
function printBanner() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║       Bing Auto-Search Application         ║");
  console.log("╚════════════════════════════════════════════╝");
}

/**
 * Prints help information
 */
function printHelp() {
  console.log("\nConfiguration:");
  console.log(`• Interval: ${formatInterval(config.minIntervalMs)} - ${formatInterval(config.maxIntervalMs)}`);
  console.log(`• Typing delay: ${config.typingDelayMs}ms per character`);
  console.log(`• Max searches: ${config.maxSearches === 0 ? "Unlimited" : config.maxSearches}`);
  console.log(`• Debug port: ${config.chromeDebugPort}`);
  console.log("\nEnvironment variables:");
  console.log("• GEMINI_API_KEY - Required for generating search terms");
  console.log("• CHROME_DEBUG_PORT - Override default debug port (default: 9222)");
  console.log("• MAX_SEARCHES - Override max searches (default: 30)");
  console.log("• MIN_INTERVAL_MINUTES - Override min interval (default: 3)");
  console.log("• MAX_INTERVAL_MINUTES - Override max interval (default: 5)");
  console.log("\nPress Ctrl+C to stop the application.");
}

/**
 * Generates search terms with retry logic
 * @returns {Promise<boolean>}
 */
async function generateSearchTermsWithRetry() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`→ Attempt ${attempt} of ${maxAttempts}...`);

    try {
      await generateTerms();

      if (existsSync(SEARCH_TERMS_PATH)) {
        console.log("✓ Search terms generated successfully!");
        return true;
      }
    } catch (error) {
      console.error(`✗ Error:`, error instanceof Error ? error.message : error);
    }

    if (attempt < maxAttempts) {
      console.log("→ Waiting 30 seconds before retry...");
      await sleep(30000);
    }
  }

  return false;
}

/**
 * Main search loop
 */
async function runSearchLoop() {
  const searchTerms = JSON.parse(readFileSync(SEARCH_TERMS_PATH, "utf-8"));

  // Initialize browser connection
  try {
    await initBrowser();
  } catch (error) {
    console.error("✗ Failed to connect to Chrome.\n");
    console.error("Error:", error instanceof Error ? error.message : error);
    await cleanup();
    process.exit(1);
  }

  let searchCount = 0;
  let termIndex = 0;
  let timeoutId = null;
  let isRunning = true;
  let countdownIntervalId = null;

  // Register cleanup handlers
  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  console.log("─".repeat(50) + "\n");

  // Perform initial search immediately
  const { term: initialTerm, nextIndex: newIndex } = getSearchTerm(searchTerms, termIndex);
  termIndex = newIndex;
  const initialSuccess = await performSearchWithRetry(initialTerm);

  if (initialSuccess) {
    searchCount++;
  } else {
    console.log("\nSearch failed after all retry attempts. Shutting down...");
    await cleanup();
    process.exit(1);
  }

  // Schedule the next search
  await scheduleNextSearch();

  /**
   * Handles graceful shutdown
   */
  async function handleShutdown() {
    console.log("\n\n🛑 Shutting down...");
    console.log(`Total searches performed: ${searchCount}`);
    isRunning = false;
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    if (timeoutId) clearTimeout(timeoutId);
    await cleanup();
    process.exit(0);
  }

  /**
   * Starts a countdown timer
   * @param {number} totalMs - Total milliseconds
   */
  function startCountdown(totalMs) {
    let remainingMs = totalMs;

    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
    }

    countdownIntervalId = setInterval(() => {
      if (remainingMs <= 0) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        process.stdout.write("\r");
        return;
      }

      process.stdout.write(`\r⏱  Next search in: ${formatInterval(remainingMs)}`);
      remainingMs -= 1000;
    }, 1000);

    console.log("");
  }

  /**
   * Schedules the next search
   */
  async function scheduleNextSearch() {
    if (!isRunning) return;

    if (config.maxSearches > 0 && searchCount >= config.maxSearches) {
      console.log(`\n✓ Reached maximum number of searches (${config.maxSearches}). Stopping...`);
      await cleanup();
      process.exit(0);
    }

    const nextInterval = getRandomInterval();
    console.log(`Total searches performed: ${searchCount}`);
    startCountdown(nextInterval);

    timeoutId = setTimeout(async () => {
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
        await cleanup();
        process.exit(1);
      }
    }, nextInterval);
  }
}

/**
 * Cleanup resources
 */
async function cleanup() {
  try {
    await closeBrowser();
  } catch {
    // Ignore cleanup errors
  }
}

// Run main
main().catch(async (error) => {
  console.error("Fatal error:", error);
  await cleanup();
  process.exit(1);
});
