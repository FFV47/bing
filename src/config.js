import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parses an integer from environment variable with a default value
 * @param {string | undefined} value
 * @param {number} defaultValue
 * @returns {number}
 */
function parseIntEnv(value, defaultValue) {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Configuration for the Bing auto-search application
 * All values can be overridden via environment variables
 */
export const config = {
  /** Minimum interval between searches in milliseconds */
  minIntervalMs: parseIntEnv(process.env.MIN_INTERVAL_MINUTES, 3) * 60 * 1000,

  /** Maximum interval between searches in milliseconds */
  maxIntervalMs: parseIntEnv(process.env.MAX_INTERVAL_MINUTES, 5) * 60 * 1000,

  /** Maximum number of searches (0 = unlimited) */
  maxSearches: parseIntEnv(process.env.MAX_SEARCHES, 30),

  /** Bing homepage URL */
  bingBaseUrl: process.env.BING_BASE_URL || "https://www.bing.com",

  /** Delay between each keystroke in milliseconds (simulates human typing) */
  typingDelayMs: parseIntEnv(process.env.TYPING_DELAY_MS, 200),

  /** Chrome remote debugging port */
  chromeDebugPort: parseIntEnv(process.env.CHROME_DEBUG_PORT, 9222),

  /** Chrome user data directory */
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || join(__dirname, "..", "chrome-user-data"),
};
