import { config } from "./config.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Creates a standard AbortError instance.
 * @returns {Error}
 */
export function createAbortError() {
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  return error;
}

/**
 * Checks whether an error represents an aborted operation.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Gets a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function getRandomBetween(min, max) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

/**
 * Gets a random interval between min and max configured values.
 * @param {number} [min]
 * @param {number} [max]
 * @returns {number} Random interval in milliseconds
 */
export function getRandomInterval(min = config.minIntervalMs, max = config.maxIntervalMs) {
  return getRandomBetween(min, max);
}

/**
 * Waits for up to `ms` milliseconds while respecting an optional AbortSignal.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function delayWithSignal(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Pauses execution for a specified duration, showing remaining time in interactive TTYs.
 * Uses wall-clock deadlines to avoid drift and supports cancellation via AbortSignal.
 *
 * @param {number} ms - Milliseconds to sleep
 * @param {{
 *   signal?: AbortSignal,
 *   silent?: boolean,
 *   label?: string,
 *   showSpinner?: boolean,
 *   stream?: Pick<NodeJS.WriteStream, "isTTY" | "write">,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function sleep(ms, options = {}) {
  const { signal, silent = false, label = "Waiting", showSpinner = true, stream = process.stdout } = options;

  if (signal?.aborted) {
    throw createAbortError();
  }

  if (ms <= 0) {
    return;
  }

  const interactive = !silent && Boolean(stream.isTTY);
  if (!interactive) {
    await delayWithSignal(ms, signal);
    return;
  }

  const updateIntervalMs = showSpinner ? 100 : 500;
  const endTime = Date.now() + ms;
  let frameIndex = 0;

  try {
    while (true) {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        break;
      }

      const prefix = showSpinner ? `${SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]} ` : "";
      stream.write(`\r${prefix}${label}: ${formatInterval(remaining)}...\x1B[K`);

      const waitTime = Math.min(updateIntervalMs, remaining);
      await delayWithSignal(waitTime, signal);
      frameIndex++;
    }
  } finally {
    stream.write("\r\x1B[2K");
  }
}

/**
 * Waits for the next scheduled search, displaying a clean countdown on interactive terminals.
 *
 * @param {number} ms
 * @param {{
 *   signal?: AbortSignal,
 *   silent?: boolean,
 *   stream?: Pick<NodeJS.WriteStream, "isTTY" | "write">,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function waitWithCountdown(ms, options = {}) {
  const stream = options.stream ?? process.stdout;
  if (!options.silent && !stream.isTTY) {
    console.log(`⏱  Next search in: ${formatInterval(ms)}`);
  }

  await sleep(ms, {
    ...options,
    label: "⏱  Next search in",
    showSpinner: false,
  });
}

/**
 * Formats a singular or plural time unit.
 * @param {number} value
 * @param {string} singular
 * @returns {string}
 */
function pluralize(value, singular) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

/**
 * Formats milliseconds into a human-readable string.
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
export function formatInterval(ms) {
  if (ms <= 0) {
    return "0 seconds";
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pluralize(hours, "hour")} ${pluralize(minutes, "minute")}`;
  }
  if (minutes > 0) {
    return `${pluralize(minutes, "minute")} ${pluralize(seconds, "second")}`;
  }
  return pluralize(seconds, "second");
}
