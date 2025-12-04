/**
 * Configuration for the Bing auto-search application
 */
export const config = {
  /** Minimum interval between searches in milliseconds */
  minIntervalMs: 3 * 60 * 1000,

  /** Maximum interval between searches in milliseconds */
  maxIntervalMs: 5 * 60 * 1000,

  /** List of search terms to cycle through */
  searchTerms: [
    "start books at home",
    "exciting tips without equipment",
    "improve fitness for adults",
    "modern facts for adults",
    "start design",
    "traditional games tips weekend",
    "healthy painting history this year",
    "painting for families",
    "ways to animals",
    "beach electronics examples",
    "interesting beach fitness",
    "easy mountain animals",
    "classic art tricks",
    "beautiful beach painting",
    "cars tutorial fall",
    "swimming at home",
    "new finance tips",
    "discover finance without equipment",
    "explore marketing step by step",
    "explore classic fashion",
    "find top cycling",
    "photography for beginners",
    "modern real estate history",
    "meditation at home",
    "local music guide",
    "interesting fashion tricks",
    "America hiking trends",
    "city painting tricks",
    "outdoor travel recipes",
    "electronics techniques this week",
  ],

  /** Maximum number of searches (0 = unlimited) */
  maxSearches: 30,

  /** Bing homepage URL */
  bingBaseUrl: "https://www.bing.com",

  /** Delay between each keystroke in milliseconds (simulates human typing) */
  typingDelayMs: 200,

  /** Chrome remote debugging port */
  chromeDebugPort: 9222,
};
