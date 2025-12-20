/**
 * Configuration for the Bing auto-search application
 */
export const config = {
  /** Minimum interval between searches in milliseconds */
  minIntervalMs: 3 * 60 * 1000,

  /** Maximum interval between searches in milliseconds */
  maxIntervalMs: 5 * 60 * 1000,

  /** Maximum number of searches (0 = unlimited) */
  maxSearches: 30,

  /** Bing homepage URL */
  bingBaseUrl: "https://www.bing.com",

  /** Delay between each keystroke in milliseconds (simulates human typing) */
  typingDelayMs: 200,

  /** Chrome remote debugging port */
  chromeDebugPort: 9222,
};
