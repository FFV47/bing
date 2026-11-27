import { readFile } from "node:fs/promises";
import * as z from "zod";
import { closeBrowser, initBrowser } from "./browser.js";
import { config, formatCliHelp, getMaxSearches, isHelpRequested, isMobileMode } from "./config.js";
import { getSearchTermsPath, SearchTermsSchema } from "./generateTermsGemini.js";
import { getSearchTerm, performSearchWithRetry } from "./search.js";
import { formatInterval, getRandomInterval, isAbortError, sleep, waitWithCountdown } from "./utils.js";

const RECOVERY_DELAY_MS = 30_000;
const MAX_RECOVERY_ATTEMPTS = 40;

/**
 * Loads and validates the generated search terms file.
 * @param {string} termsPath
 * @param {boolean} mobileMode
 * @returns {Promise<string[]>}
 */
async function loadSearchTerms(termsPath, mobileMode) {
  /** @type {string} */
  let rawContent;
  try {
    rawContent = await readFile(termsPath, "utf-8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") {
      console.error(`✗ No search terms found at ${termsPath}\n`);
      console.error("Generate them first (requires GEMINI_API_KEY to be set):");
      console.error(`  pnpm run ${mobileMode ? "generate:mobile" : "generate"}`);
      console.error("\nOr use the offline fallback generator:");
      console.error(`  node scripts/generate-terms-ptbr.js${mobileMode ? " --mobile" : ""}`);
      console.error("\nOr run ./start.sh, which generates terms and launches Chrome for you.\n");
      process.exit(1);
    }
    throw error;
  }

  /** @type {unknown} */
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Invalid JSON in search terms file (${termsPath}): ${message}\n`);
    process.exit(1);
  }

  const validation = SearchTermsSchema.safeParse(parsedJson);
  if (!validation.success) {
    console.error(`✗ Invalid search terms format in ${termsPath}:`);
    console.error(z.prettifyError(validation.error));
    process.exit(1);
  }

  return validation.data;
}

/**
 * Attempts a search with recovery for extended Chrome unresponsiveness (e.g. screen off on Wayland).
 * Falls back to a longer retry loop if the standard retry logic fails.
 *
 * @param {string} term - The search query
 * @param {AbortSignal} signal - Abort signal for graceful shutdown
 * @returns {Promise<boolean>} True if search eventually succeeded
 */
async function performSearchWithRecovery(term, signal) {
  const success = await performSearchWithRetry(term, { signal });
  if (success) return true;

  console.log("\n⏸  Search failed — Chrome may be unresponsive (screen off?).");
  console.log("→ Entering recovery mode. Will keep retrying...\n");

  for (let i = 1; i <= MAX_RECOVERY_ATTEMPTS; i++) {
    console.log(`→ Recovery attempt ${i}/${MAX_RECOVERY_ATTEMPTS} — waiting ${RECOVERY_DELAY_MS / 1000}s...`);
    await sleep(RECOVERY_DELAY_MS, { signal });

    const recovered = await performSearchWithRetry(term, { signal });
    if (recovered) {
      console.log("✓ Recovery successful!\n");
      return true;
    }
  }

  return false;
}

/**
 * Main function that runs the auto-search loop.
 * @returns {Promise<number>} Exit code (0 for normal/graceful exit, 1 for failure)
 */
async function main() {
  if (isHelpRequested()) {
    console.log(formatCliHelp());
    return 0;
  }

  const mobileMode = isMobileMode();
  const modeLabel = mobileMode ? "Mobile" : "Desktop";
  const maxSearches = getMaxSearches(config, mobileMode);

  console.log("╔════════════════════════════════════════════╗");
  console.log(`║   Bing Auto-Search Application (${modeLabel})   ║`);
  console.log("╚════════════════════════════════════════════╝\n");

  console.log("Configuration:");
  console.log(`• Mode: ${modeLabel}`);
  console.log(`• Interval: ${formatInterval(config.minIntervalMs)} - ${formatInterval(config.maxIntervalMs)}`);
  console.log(`• Typing delay: ${config.typingDelayMs}ms ± ${config.behavior.typingJitterMs}ms per character`);
  console.log(`• Chrome debug port: ${config.chromeDebugPort}`);
  console.log(`• Max searches: ${maxSearches === 0 ? "Unlimited" : maxSearches}`);
  console.log("\nPress Ctrl+C to stop the application.\n");
  console.log("─".repeat(50) + "\n");

  const termsPath = getSearchTermsPath(mobileMode);
  const searchTerms = await loadSearchTerms(termsPath, mobileMode);

  if (maxSearches > 0 && searchTerms.length < maxSearches) {
    console.warn(
      `⚠ Warning: Only ${searchTerms.length} search terms available for ${maxSearches} configured searches. Terms will wrap around.`
    );
  }

  const abortController = new AbortController();
  let shutdownRequested = false;

  /**
   * Handles SIGINT/SIGTERM gracefully before any work begins.
   * @param {NodeJS.Signals} signalName
   */
  const onShutdownSignal = (signalName) => {
    if (shutdownRequested) {
      console.log(`\nReceived second ${signalName}. Exiting immediately.`);
      process.exit(130);
    }

    shutdownRequested = true;
    console.log(`\n\nShutting down (${signalName})...`);
    abortController.abort();
  };

  process.on("SIGINT", onShutdownSignal);
  process.on("SIGTERM", onShutdownSignal);

  let searchCount = 0;
  let termIndex = 0;
  let exitCode = 0;

  try {
    try {
      await initBrowser();
    } catch {
      console.error("✗ Failed to connect to Chrome.\n");
      console.error("Please start Chrome with remote debugging:");
      console.error(`  google-chrome --remote-debugging-port=${config.chromeDebugPort}`);
      return 1;
    }

    let warnedWrap = false;

    while (!abortController.signal.aborted) {
      const { term, nextIndex, wrapped } = getSearchTerm(searchTerms, termIndex);
      termIndex = nextIndex;

      if (wrapped && !warnedWrap) {
        warnedWrap = true;
        console.warn("⚠ Reached the end of the search terms list — repeating from the beginning.\n");
      }

      const success = await performSearchWithRecovery(term, abortController.signal);
      if (!success) {
        console.log("\nSearch failed after all recovery attempts. Shutting down...");
        exitCode = 1;
        break;
      }

      searchCount++;
      const progressLabel = maxSearches > 0 ? `${searchCount}/${maxSearches}` : String(searchCount);
      console.log(`✓ Completed search ${progressLabel}`);

      if (maxSearches > 0 && searchCount >= maxSearches) {
        console.log(`\nReached maximum number of searches (${maxSearches}). Stopping...`);
        break;
      }

      const nextInterval = getRandomInterval();
      await waitWithCountdown(nextInterval, { signal: abortController.signal });
    }
  } catch (error) {
    if (!isAbortError(error)) {
      throw error;
    }
  } finally {
    process.off("SIGINT", onShutdownSignal);
    process.off("SIGTERM", onShutdownSignal);
    console.log(`Total searches performed: ${searchCount}`);
    await closeBrowser();
  }

  return exitCode;
}

try {
  const code = await main();
  process.exit(code);
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}
