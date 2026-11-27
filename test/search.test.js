import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig } from "../src/config.js";
import { getSearchTerm, isDisconnectedError, performSearch, performSearchWithRetry } from "../src/search.js";
import { isAbortError } from "../src/utils.js";

/**
 * Creates a lightweight test config with zero delays so tests run instantaneously.
 * @returns {import("../src/config.js").AppConfig}
 */
function createFastConfig() {
  return {
    ...defaultConfig,
    typingDelayMs: 0,
    behavior: {
      typingJitterMs: 0,
      preSubmitDelayMs: { min: 0, max: 0 },
      preScrollDelayMs: { min: 0, max: 0 },
      scrollDownDurationMs: { min: 0, max: 0 },
      bottomPauseMs: { min: 0, max: 0 },
      scrollUpDurationMs: { min: 0, max: 0 },
    },
  };
}

/**
 * Creates a mock Puppeteer page recording method call ordering.
 * @param {{ scrollHeight?: number, onGoto?: () => Promise<void> }} [options]
 */
function createMockPage(options = {}) {
  /** @type {string[]} */
  const calls = [];
  const scrollHeight = options.scrollHeight ?? 0;

  const page = {
    async goto() {
      calls.push("goto");
      if (options.onGoto) {
        await options.onGoto();
      }
    },
    $() {
      return Promise.resolve(null);
    },
    waitForSelector() {
      calls.push("waitForSelector");
      return Promise.resolve(null);
    },
    click() {
      calls.push("click");
      return Promise.resolve();
    },
    keyboard: {
      down(/** @type {string} */ key) {
        calls.push(`down:${key}`);
        return Promise.resolve();
      },
      up(/** @type {string} */ key) {
        calls.push(`up:${key}`);
        return Promise.resolve();
      },
      press(/** @type {string} */ key) {
        calls.push(`press:${key}`);
        return Promise.resolve();
      },
      type(/** @type {string} */ text) {
        calls.push(`type:${text}`);
        return Promise.resolve();
      },
    },
    waitForNavigation() {
      calls.push("waitForNavigation");
      return Promise.resolve(null);
    },
    evaluate() {
      calls.push("evaluate");
      return Promise.resolve(scrollHeight);
    },
  };

  return {
    page: /** @type {unknown} */ (page),
    calls,
  };
}

await describe("getSearchTerm", async () => {
  await it("cycles through terms and reports when wrapping occurs", () => {
    const terms = ["a", "b"];

    assert.deepEqual(getSearchTerm(terms, 0), { term: "a", nextIndex: 1, wrapped: false });
    assert.deepEqual(getSearchTerm(terms, 1), { term: "b", nextIndex: 2, wrapped: false });
    assert.deepEqual(getSearchTerm(terms, 2), { term: "a", nextIndex: 3, wrapped: true });
  });

  await it("throws when the terms array is empty", () => {
    assert.throws(() => getSearchTerm([], 0), /non-empty array/);
  });
});

await describe("isDisconnectedError", async () => {
  await it("treats protocol and closed-session errors as disconnections", () => {
    const protocolErr = new Error("Runtime.callFunctionOn timed out");
    protocolErr.name = "ProtocolError";

    assert.equal(isDisconnectedError(protocolErr, true), true);
    assert.equal(isDisconnectedError(new Error("Target closed"), true), true);
    assert.equal(isDisconnectedError(new Error("Anything"), false), true);
  });

  await it("does not treat standard navigation timeouts as Chrome disconnections", () => {
    const navTimeout = new Error("Navigation timeout of 15000 ms exceeded");
    navTimeout.name = "TimeoutError";

    assert.equal(isDisconnectedError(navTimeout, true), false);
  });
});

await describe("performSearch", async () => {
  await it("registers waitForNavigation before pressing Enter and skips scroll when maxScroll is 0", async () => {
    const { page, calls } = createMockPage({ scrollHeight: 0 });
    const noopSleep = () => Promise.resolve();

    await performSearch("receita pão de queijo", {
      deps: {
        getPage: () => /** @type {import("puppeteer-core").Page} */ (page),
        cfg: createFastConfig(),
        sleepFn: noopSleep,
        randomBetween: (min) => min,
      },
    });

    const navIndex = calls.indexOf("waitForNavigation");
    const enterIndex = calls.indexOf("press:Enter");
    assert.ok(navIndex !== -1 && enterIndex !== -1);
    assert.ok(navIndex < enterIndex, "waitForNavigation must be registered before pressing Enter");
    // Only one evaluate call (getMaxScrollHeight), no smoothScroll calls
    assert.equal(calls.filter((call) => call === "evaluate").length, 1);
  });
});

await describe("performSearchWithRetry", async () => {
  await it("retries transient page errors without triggering browser reconnection", async () => {
    let attempts = 0;
    let reconnectCalls = 0;
    /** @type {number[]} */
    const sleepDurations = [];

    const { page } = createMockPage({
      onGoto: () => {
        attempts++;
        if (attempts === 1) {
          const timeoutError = new Error("Navigation timeout of 15000 ms exceeded");
          timeoutError.name = "TimeoutError";
          return Promise.reject(timeoutError);
        }
        return Promise.resolve();
      },
    });

    const ok = await performSearchWithRetry("teste", {
      maxAttempts: 3,
      retryDelayMs: 10,
      deps: {
        getPage: () => /** @type {import("puppeteer-core").Page} */ (page),
        isBrowserConnected: () => true,
        reconnectBrowser: () => {
          reconnectCalls++;
          return Promise.resolve(true);
        },
        cfg: createFastConfig(),
        sleepFn: (ms) => {
          sleepDurations.push(ms);
          return Promise.resolve();
        },
        randomBetween: (min) => min,
      },
    });

    assert.equal(ok, true);
    assert.equal(attempts, 2);
    assert.equal(reconnectCalls, 0);
    assert.deepEqual(
      sleepDurations.filter((ms) => ms > 0),
      [10]
    );
  });

  await it("reconnects on protocol errors without double-sleeping when reconnection fails", async () => {
    let reconnectCalls = 0;
    let extraSleepCalls = 0;

    const { page } = createMockPage({
      onGoto: () => {
        const err = new Error("Protocol error: Target closed");
        err.name = "ProtocolError";
        return Promise.reject(err);
      },
    });

    const ok = await performSearchWithRetry("teste", {
      maxAttempts: 3,
      retryDelayMs: 10,
      deps: {
        getPage: () => /** @type {import("puppeteer-core").Page} */ (page),
        isBrowserConnected: () => true,
        reconnectBrowser: () => {
          reconnectCalls++;
          return Promise.resolve(false);
        },
        cfg: createFastConfig(),
        sleepFn: () => {
          extraSleepCalls++;
          return Promise.resolve();
        },
        randomBetween: (min) => min,
      },
    });

    assert.equal(ok, false);
    assert.equal(reconnectCalls, 2);
    assert.equal(extraSleepCalls, 0);
  });

  await it("propagates AbortError immediately without retrying", async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () =>
        performSearchWithRetry("teste", {
          signal: controller.signal,
          deps: {
            isBrowserConnected: () => true,
          },
        }),
      (error) => isAbortError(error)
    );
  });
});
