import { config } from "./config.js";

/**
 * Gets a random interval between min and max configured values
 * @returns {number} Random interval in milliseconds
 */
export function getRandomInterval() {
  const { minIntervalMs, maxIntervalMs } = config;
  return Math.floor(Math.random() * (maxIntervalMs - minIntervalMs + 1)) + minIntervalMs;
}

/**
 * Pauses execution for a specified duration, showing remaining time in console
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export async function sleep(ms) {
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  const updateIntervalMs = 100;
  let remaining = ms;
  let frameIndex = 0;

  while (remaining > 0) {
    const spinner = spinnerFrames[frameIndex % spinnerFrames.length];
    process.stdout.write(`\r${spinner} Waiting: ${formatInterval(remaining)}...`);

    const waitTime = Math.min(updateIntervalMs, remaining);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    remaining -= waitTime;
    frameIndex++;
  }

  process.stdout.write("\x1B[2K\r"); // Clear the line
}

/**
 * Formats milliseconds into a human-readable string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
export function formatInterval(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} hour(s) ${minutes % 60} minute(s)`;
  }
  if (minutes > 0) {
    return `${minutes} minute(s) ${seconds % 60} second(s)`;
  }
  return `${seconds} second(s)`;
}
