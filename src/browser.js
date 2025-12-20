import puppeteer from "puppeteer";
import { config } from "./config.js";
import { sleep } from "./utils.js";

/** @type {import('puppeteer').Browser | null} */
let browser = null;

/** @type {import('puppeteer').Page | null} */
let page = null;

/**>
 * Gets the current page instance
 * @returns {import('puppeteer').Page | null}
 */
export function getPage() {
  return page;
}

/**
 * Checks if the browser is still connected
 * @returns {boolean}
 */
export function isBrowserConnected() {
  return browser !== null && browser.connected;
}

/**
 * Initializes the browser instance by connecting to an existing Chrome
 * @returns {Promise<void>}
 */
export async function initBrowser() {
  const debugUrl = `http://127.0.0.1:${config.chromeDebugPort}`;

  console.log("Connecting to Chrome instance...");
  console.log(`Debug URL: ${debugUrl}`);

  browser = await puppeteer.connect({
    "browserURL": debugUrl,
    "defaultViewport": null,
  });

  // Use the existing tab instead of creating a new one
  const pages = await browser.pages();
  page = pages[0] || (await browser.newPage());
  console.log("✓ Connected to Chrome successfully!\n");
}

/**
 * Attempts to reconnect to Chrome
 * @param {number} retryDelayMs - Delay before attempting reconnection
 * @returns {Promise<boolean>} True if reconnection was successful
 */
export async function reconnectBrowser(retryDelayMs) {
  console.log("\nAttempting to reconnect to Chrome...");

  // Clean up existing connections
  page = null;

  if (browser) {
    try {
      await browser.disconnect();
    } catch {
      // Browser might already be disconnected
    }
    browser = null;
  }

  // Wait a bit before trying to reconnect
  await sleep(retryDelayMs);

  try {
    await initBrowser();
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnects from the browser gracefully (does not close Chrome)
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  page = null;
  if (browser) {
    await browser.disconnect(); // Disconnect without closing Chrome
    browser = null;
  }
}
