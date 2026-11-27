import puppeteer from "puppeteer-core";
import { config, isMobileMode } from "./config.js";
import { sleep } from "./utils.js";

/** @type {import("puppeteer-core").Browser | null} */
let browser = null;

/** @type {import("puppeteer-core").Page | null} */
let page = null;

/**
 * Gets the current page instance.
 * @returns {import("puppeteer-core").Page | null}
 */
export function getPage() {
  if (page && page.isClosed()) {
    page = null;
  }
  return page;
}

/**
 * Checks if the browser and active page are still connected and open.
 * @returns {boolean}
 */
export function isBrowserConnected() {
  return browser !== null && browser.connected && page !== null && !page.isClosed();
}

/**
 * Applies mobile emulation settings (viewport + UA + Client Hints) to the page.
 * @param {import("puppeteer-core").Page} targetPage - The page to configure
 * @returns {Promise<void>}
 */
async function applyMobileEmulation(targetPage) {
  await targetPage.setViewport(config.mobile.viewport);

  await targetPage.setUserAgent({
    userAgent: config.mobile.userAgent,
    userAgentMetadata: config.mobile.userAgentMetadata,
    platform: config.mobile.platform,
  });

  console.log("✓ Mobile emulation enabled");
}

/**
 * Initializes the browser instance by connecting to an existing Chrome over CDP.
 * @returns {Promise<void>}
 */
export async function initBrowser() {
  const debugUrl = `http://127.0.0.1:${config.chromeDebugPort}`;

  console.log("Connecting to Chrome instance...");
  console.log(`Debug URL: ${debugUrl}`);

  browser = await puppeteer.connect({
    browserURL: debugUrl,
    defaultViewport: null,
    protocolTimeout: 60_000,
  });

  const pages = await browser.pages();
  const existingPage = pages.find((candidate) => !candidate.isClosed());
  page = existingPage ?? (await browser.newPage());

  if (isMobileMode()) {
    await applyMobileEmulation(page);
  }

  console.log("✓ Connected to Chrome successfully!\n");
}

/**
 * Attempts to reconnect to Chrome after a delay.
 * @param {number} retryDelayMs - Delay before attempting reconnection
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<boolean>} True if reconnection was successful
 */
export async function reconnectBrowser(retryDelayMs, options = {}) {
  console.log("\nAttempting to reconnect to Chrome...");

  await closeBrowser();

  await sleep(retryDelayMs, { signal: options.signal });

  try {
    await initBrowser();
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnects from the browser gracefully (does not close Chrome).
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  page = null;
  const currentBrowser = browser;
  browser = null;

  if (currentBrowser) {
    try {
      await currentBrowser.disconnect();
    } catch {
      // Browser might already be disconnected or closed
    }
  }
}
