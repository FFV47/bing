import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig, getGeminiApiKey, getMaxSearches, resolveConfig } from "../src/config.js";

await describe("resolveConfig", async () => {
  await it("returns validated defaults when no CLI args or env vars are provided", () => {
    const result = resolveConfig({ argv: [], env: {} });

    assert.equal(result.mobileMode, false);
    assert.equal(result.helpRequested, false);
    assert.equal(result.config.minIntervalMs, defaultConfig.minIntervalMs);
    assert.equal(result.config.maxIntervalMs, defaultConfig.maxIntervalMs);
    assert.equal(result.config.maxSearches, defaultConfig.maxSearches);
    assert.equal(result.config.chromeDebugPort, 9222);
    assert.equal(result.config.mobile.userAgentMetadata.mobile, true);
  });

  await it("applies environment variables and lets CLI flags take precedence", () => {
    const result = resolveConfig({
      argv: ["--mobile", "--port", "9333", "--max-searches", "28", "--mobile-max-searches", "15", "--lang", "English"],
      env: {
        CHROME_DEBUG_PORT: "9444",
        BING_MAX_SEARCHES: "25",
        BING_MOBILE_MAX_SEARCHES: "18",
        BING_MIN_INTERVAL_MS: "10000",
        BING_MAX_INTERVAL_MS: "20000",
        BING_SEARCH_LANGUAGE: "Spanish",
      },
    });

    assert.equal(result.mobileMode, true);
    assert.equal(result.config.chromeDebugPort, 9333);
    assert.equal(result.config.maxSearches, 28);
    assert.equal(result.config.mobile.maxSearches, 15);
    assert.equal(result.config.minIntervalMs, 10_000);
    assert.equal(result.config.maxIntervalMs, 20_000);
    assert.equal(result.config.searchLanguage, "English");
  });

  await it("keeps desktop and mobile max searches isolated unless --max-searches is used as mobile fallback", () => {
    const desktopRun = resolveConfig({
      argv: ["--max-searches", "12"],
      env: { BING_MOBILE_MAX_SEARCHES: "18" },
    });
    assert.equal(desktopRun.config.maxSearches, 12);
    assert.equal(desktopRun.config.mobile.maxSearches, 18);

    const mobileFallback = resolveConfig({
      argv: ["--mobile", "--max-searches", "12"],
      env: { BING_MOBILE_MAX_SEARCHES: "18" },
    });
    assert.equal(mobileFallback.config.mobile.maxSearches, 12);
  });

  await it("rejects invalid invariants such as minIntervalMs > maxIntervalMs", () => {
    assert.throws(
      () =>
        resolveConfig({
          argv: ["--min-interval", "5000", "--max-interval", "1000"],
          env: {},
        }),
      /minIntervalMs must be less than or equal to maxIntervalMs/
    );
  });

  await it("rejects invalid ports and non-integer CLI values", () => {
    assert.throws(() => resolveConfig({ argv: ["--port", "abc"], env: {} }), /Invalid integer value for --port/);
    assert.throws(() => resolveConfig({ argv: ["--port", "70000"], env: {} }), /Invalid configuration/);
    assert.throws(() => resolveConfig({ argv: [], env: { BING_BASE_URL: "not-a-url" } }), /Invalid configuration/);
  });
});

await describe("getMaxSearches", async () => {
  await it("returns mode-specific limits", () => {
    const { config } = resolveConfig({
      argv: [],
      env: { BING_MAX_SEARCHES: "30", BING_MOBILE_MAX_SEARCHES: "12" },
    });

    assert.equal(getMaxSearches(config, false), 30);
    assert.equal(getMaxSearches(config, true), 12);
  });
});

await describe("getGeminiApiKey", async () => {
  await it("prefers GOOGLE_API_KEY over GEMINI_API_KEY and trims whitespace", () => {
    assert.equal(getGeminiApiKey({ GOOGLE_API_KEY: "  g-key  ", GEMINI_API_KEY: "m-key" }), "g-key");
    assert.equal(getGeminiApiKey({ GOOGLE_API_KEY: "   ", GEMINI_API_KEY: " m-key " }), "m-key");
    assert.equal(getGeminiApiKey({}), null);
  });
});
