/**
 * Configuration for the Bing auto-search application
 */
export const config = {
  /** Minimum interval between searches in milliseconds */
  minIntervalMs: 3 * 60 * 1000,

  /** Maximum interval between searches in milliseconds */
  maxIntervalMs: 5 * 60 * 1000,

  /** Maximum number of searches (0 = unlimited) */
  maxSearches: 20,

  /** Bing homepage URL */
  bingBaseUrl: "https://www.bing.com",

  /** Delay between each keystroke in milliseconds (simulates human typing) */
  typingDelayMs: 200,

  /** Chrome remote debugging port */
  chromeDebugPort: 9222,

  /** Mobile emulation settings */
  mobile: {
    /** Maximum number of searches for mobile (0 = unlimited) */
    maxSearches: 20,

    /** Mobile user agent string (Android Chrome) */
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",

    /** Mobile viewport dimensions */
    viewport: {
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
    },
  },
};

/**
 * Determines if mobile mode is enabled based on CLI arguments
 * @returns {boolean}
 */
export function isMobileMode() {
  return process.argv.includes("--mobile") || process.argv.includes("-m");
}

/**
 * Gets the maximum number of searches based on the current mode
 * @returns {number}
 */
export function getMaxSearches() {
  return isMobileMode() ? config.mobile.maxSearches : config.maxSearches;
}
