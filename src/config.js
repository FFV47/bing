/**
 * Configuration for the Bing auto-search application
 */
export const config = {
  /** Minimum interval between searches in milliseconds */
  minIntervalMs: 8 * 60 * 1000,

  /** Maximum interval between searches in milliseconds */
  maxIntervalMs: 10 * 60 * 1000,

  /** List of search terms to cycle through */
  searchTerms: [
    "important business tips holiday",
    "classic country cycling",
    "delicious programming stories today",
    "art guide today",
    "finance strategies this week",
    "painting for adults",
    "Europe science news",
    "understand art for adults",
    "new music secrets",
    "city electronics guide",
    "quick local drawing",
    "find camping",
    "books reviews holiday",
    "explore woodworking",
    "mountain camping news",
    "beach animals tricks",
    "mountain camping secrets",
    "mountain photography tips",
    "start design for beginners",
    "how to electronics for kids",
    "important guide for kids",
    "yoga trends today",
    "learn practical photography",
    "useful city fashion",
    "learn modern drawing",
    "outdoor movies methods",
    "quick Europe cars",
    "interior design for families",
    "country science ideas",
    "discover crafts",
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
