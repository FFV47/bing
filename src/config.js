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
    "stunning business reviews",
    "books facts weekend",
    "amazing movies facts 2025",
    "painting for beginners",
    "classic stories for experts",
    "popular reviews on a budget",
    "improve interesting books",
    "how to cooking step by step",
    "latest strategies at home",
    "meditation history holiday",
    "beach science history",
    "how to cars for adults",
    "popular business trends",
    "home real estate tutorial",
    "innovative techniques for experts",
    "amazing cryptocurrency examples",
    "Europe swimming reviews",
    "how to advanced sports",
    "amazing guide at home",
    "creative photography benefits this week",
    "amazing meditation tips this year",
    "beautiful sports guide",
    "country interior design strategies",
    "new fashion stories today",
    "beach games tricks",
    "discover interior design without equipment",
    "Europe crafts examples",
    "country fitness techniques",
    "finance for adults",
    "outdoor marketing examples",
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
