import { parseArgs } from "node:util";
import * as z from "zod";

/**
 * Loads a local `.env` file if present, without overwriting already-set env vars.
 */
function loadOptionalEnvFile() {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  try {
    process.loadEnvFile();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

loadOptionalEnvFile();

const RangeSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .refine((range) => range.min <= range.max, {
    message: "Range min must be less than or equal to max",
    path: ["min"],
  });

const UserAgentBrandSchema = z.object({
  brand: z.string().min(1),
  version: z.string().min(1),
});

export const ConfigSchema = z
  .object({
    minIntervalMs: z.number().int().nonnegative(),
    maxIntervalMs: z.number().int().nonnegative(),
    maxSearches: z.number().int().nonnegative(),
    defaultTermCount: z.number().int().positive(),
    termHistoryLimit: z.number().int().nonnegative(),
    searchLanguage: z.string().trim().min(1),
    bingBaseUrl: z.url(),
    typingDelayMs: z.number().int().nonnegative(),
    chromeDebugPort: z.number().int().min(1).max(65535),
    behavior: z.object({
      typingJitterMs: z.number().int().nonnegative(),
      preSubmitDelayMs: RangeSchema,
      preScrollDelayMs: RangeSchema,
      scrollDownDurationMs: RangeSchema,
      bottomPauseMs: RangeSchema,
      scrollUpDurationMs: RangeSchema,
    }),
    mobile: z.object({
      maxSearches: z.number().int().nonnegative(),
      userAgent: z.string().min(1),
      platform: z.string().min(1),
      userAgentMetadata: z.object({
        brands: z.array(UserAgentBrandSchema).min(1),
        fullVersionList: z.array(UserAgentBrandSchema).min(1),
        fullVersion: z.string().min(1),
        platform: z.string().min(1),
        platformVersion: z.string().min(1),
        architecture: z.string(),
        model: z.string(),
        mobile: z.boolean(),
        bitness: z.string(),
        wow64: z.boolean(),
      }),
      viewport: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        deviceScaleFactor: z.number().positive(),
        isMobile: z.boolean(),
        hasTouch: z.boolean(),
      }),
    }),
  })
  .refine((cfg) => cfg.minIntervalMs <= cfg.maxIntervalMs, {
    message: "minIntervalMs must be less than or equal to maxIntervalMs",
    path: ["minIntervalMs"],
  });

/** @typedef {z.infer<typeof ConfigSchema>} AppConfig */

/** @type {AppConfig} */
export const defaultConfig = {
  /** Minimum interval between searches in milliseconds */
  minIntervalMs: 1 * 60 * 1000,

  /** Maximum interval between searches in milliseconds */
  maxIntervalMs: 2 * 60 * 1000,

  /** Maximum number of searches (0 = unlimited) */
  maxSearches: 20,

  /** Number of terms to generate when maxSearches is 0 (unlimited) */
  defaultTermCount: 30,

  /** Rolling number of previously generated terms kept to avoid repeats */
  termHistoryLimit: 150,

  /** Language requested when generating search terms */
  searchLanguage: "Brazilian Portuguese",

  /** Bing homepage URL */
  bingBaseUrl: "https://www.bing.com",

  /** Base delay between each keystroke in milliseconds (simulates human typing) */
  typingDelayMs: 200,

  /** Chrome remote debugging port */
  chromeDebugPort: 9222,

  /** Human-like interaction timing ranges in milliseconds */
  behavior: {
    typingJitterMs: 80,
    preSubmitDelayMs: { min: 1_200, max: 3_000 },
    preScrollDelayMs: { min: 7_000, max: 13_000 },
    scrollDownDurationMs: { min: 15_000, max: 25_000 },
    bottomPauseMs: { min: 1_500, max: 3_500 },
    scrollUpDurationMs: { min: 2_000, max: 4_000 },
  },

  /** Mobile emulation settings */
  mobile: {
    /** Maximum number of searches for mobile (0 = unlimited) */
    maxSearches: 20,

    /** Mobile user agent string (Android Chrome) */
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",

    /** Mobile OS platform reported via Client Hints */
    platform: "Android",

    /** User-Agent Client Hints metadata matching the Android Chrome UA */
    userAgentMetadata: {
      brands: [
        { brand: "Chromium", version: "134" },
        { brand: "Google Chrome", version: "134" },
        { brand: "Not:A-Brand", version: "24" },
      ],
      fullVersionList: [
        { brand: "Chromium", version: "134.0.6998.165" },
        { brand: "Google Chrome", version: "134.0.6998.165" },
        { brand: "Not:A-Brand", version: "24.0.0.0" },
      ],
      fullVersion: "134.0.6998.165",
      platform: "Android",
      platformVersion: "14.0.0",
      architecture: "",
      model: "Pixel 8",
      mobile: true,
      bitness: "",
      wow64: false,
    },

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
 * Parses an optional integer from a CLI flag or environment variable.
 * @param {string | undefined} rawValue
 * @param {string} name
 * @returns {number | undefined}
 */
function parseOptionalInt(rawValue, name) {
  if (rawValue === undefined || rawValue.trim() === "") {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid integer value for ${name}: "${rawValue}"`);
  }

  return Number.parseInt(trimmed, 10);
}

/**
 * Parses supported CLI arguments.
 * @param {string[]} [argv]
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    strict: false,
    allowPositionals: true,
    options: {
      mobile: { type: "boolean", short: "m" },
      help: { type: "boolean", short: "h" },
      "max-searches": { type: "string" },
      "mobile-max-searches": { type: "string" },
      "min-interval": { type: "string" },
      "max-interval": { type: "string" },
      "typing-delay": { type: "string" },
      port: { type: "string" },
      lang: { type: "string" },
    },
  });

  /**
   * @param {string | boolean | undefined} value
   * @returns {string | undefined}
   */
  const asString = (value) => (typeof value === "string" ? value : undefined);

  return {
    mobile: values.mobile === true,
    help: values.help === true,
    maxSearches: asString(values["max-searches"]),
    mobileMaxSearches: asString(values["mobile-max-searches"]),
    minIntervalMs: asString(values["min-interval"]),
    maxIntervalMs: asString(values["max-interval"]),
    typingDelayMs: asString(values["typing-delay"]),
    chromeDebugPort: asString(values.port),
    searchLanguage: asString(values.lang),
  };
}

/**
 * Resolves and validates application configuration by combining defaults,
 * environment variables, and CLI arguments (CLI > env > defaults).
 *
 * @param {{ argv?: string[], env?: Record<string, string | undefined> }} [options]
 * @returns {{ config: AppConfig, mobileMode: boolean, helpRequested: boolean }}
 */
export function resolveConfig(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const cli = parseCliArgs(argv);

  const cliMaxSearches = parseOptionalInt(cli.maxSearches, "--max-searches");
  const cliMobileMaxSearches = parseOptionalInt(cli.mobileMaxSearches, "--mobile-max-searches");
  const envMaxSearches = parseOptionalInt(env.BING_MAX_SEARCHES, "BING_MAX_SEARCHES");
  const envMobileMaxSearches = parseOptionalInt(env.BING_MOBILE_MAX_SEARCHES, "BING_MOBILE_MAX_SEARCHES");

  const resolvedMobileMaxSearches =
    cliMobileMaxSearches ??
    (cli.mobile ? cliMaxSearches : undefined) ??
    envMobileMaxSearches ??
    defaultConfig.mobile.maxSearches;

  const rawConfig = {
    ...defaultConfig,
    minIntervalMs:
      parseOptionalInt(cli.minIntervalMs, "--min-interval") ??
      parseOptionalInt(env.BING_MIN_INTERVAL_MS, "BING_MIN_INTERVAL_MS") ??
      defaultConfig.minIntervalMs,
    maxIntervalMs:
      parseOptionalInt(cli.maxIntervalMs, "--max-interval") ??
      parseOptionalInt(env.BING_MAX_INTERVAL_MS, "BING_MAX_INTERVAL_MS") ??
      defaultConfig.maxIntervalMs,
    maxSearches: cliMaxSearches ?? envMaxSearches ?? defaultConfig.maxSearches,
    defaultTermCount:
      parseOptionalInt(env.BING_DEFAULT_TERM_COUNT, "BING_DEFAULT_TERM_COUNT") ?? defaultConfig.defaultTermCount,
    termHistoryLimit:
      parseOptionalInt(env.BING_TERM_HISTORY_LIMIT, "BING_TERM_HISTORY_LIMIT") ?? defaultConfig.termHistoryLimit,
    searchLanguage: cli.searchLanguage?.trim() || env.BING_SEARCH_LANGUAGE?.trim() || defaultConfig.searchLanguage,
    bingBaseUrl: env.BING_BASE_URL?.trim() || defaultConfig.bingBaseUrl,
    typingDelayMs:
      parseOptionalInt(cli.typingDelayMs, "--typing-delay") ??
      parseOptionalInt(env.BING_TYPING_DELAY_MS, "BING_TYPING_DELAY_MS") ??
      defaultConfig.typingDelayMs,
    chromeDebugPort:
      parseOptionalInt(cli.chromeDebugPort, "--port") ??
      parseOptionalInt(env.CHROME_DEBUG_PORT, "CHROME_DEBUG_PORT") ??
      defaultConfig.chromeDebugPort,
    behavior: {
      ...defaultConfig.behavior,
      typingJitterMs:
        parseOptionalInt(env.BING_TYPING_JITTER_MS, "BING_TYPING_JITTER_MS") ?? defaultConfig.behavior.typingJitterMs,
    },
    mobile: {
      ...defaultConfig.mobile,
      maxSearches: resolvedMobileMaxSearches,
    },
  };

  const parsed = ConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`);
    throw new Error(`Invalid configuration:\n  - ${details.join("\n  - ")}`);
  }

  return {
    config: parsed.data,
    mobileMode: cli.mobile,
    helpRequested: cli.help,
  };
}

/**
 * Validated runtime configuration for the current process.
 */
export const config = resolveConfig().config;

/**
 * Determines if mobile mode is enabled based on CLI arguments.
 * @param {string[]} [argv]
 * @returns {boolean}
 */
export function isMobileMode(argv = process.argv.slice(2)) {
  return parseCliArgs(argv).mobile;
}

/**
 * Determines if CLI help was requested.
 * @param {string[]} [argv]
 * @returns {boolean}
 */
export function isHelpRequested(argv = process.argv.slice(2)) {
  return parseCliArgs(argv).help;
}

/**
 * Gets the maximum number of searches based on the current mode.
 * @param {AppConfig} [cfg]
 * @param {boolean} [mobile]
 * @returns {number}
 */
export function getMaxSearches(cfg = config, mobile = isMobileMode()) {
  return mobile ? cfg.mobile.maxSearches : cfg.maxSearches;
}

/**
 * Resolves the Gemini API key from the environment.
 *
 * Mirrors the lookup order of `@google/genai` (GOOGLE_API_KEY wins over
 * GEMINI_API_KEY) so this check can never disagree with the SDK.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null} The key, or null when none is set
 */
export function getGeminiApiKey(env = process.env) {
  for (const name of ["GOOGLE_API_KEY", "GEMINI_API_KEY"]) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Returns formatted CLI usage text.
 * @returns {string}
 */
export function formatCliHelp() {
  return [
    "Usage: node src/index.js [options]",
    "",
    "Options:",
    "  -m, --mobile                     Run in mobile emulation mode",
    "  --max-searches <number>          Maximum desktop searches (0 = unlimited)",
    "  --mobile-max-searches <number>   Maximum mobile searches (0 = unlimited)",
    "  --min-interval <ms>              Minimum wait between searches in milliseconds",
    "  --max-interval <ms>              Maximum wait between searches in milliseconds",
    "  --typing-delay <ms>              Base delay per keystroke in milliseconds",
    "  --port <number>                  Chrome remote debugging port (default: 9222)",
    "  --lang <language>                Language for generated terms (default: Brazilian Portuguese)",
    "  -h, --help                       Show this help message",
  ].join("\n");
}
