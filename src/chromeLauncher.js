import { exec, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { platform } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Chrome executable paths for different operating systems
 */
const CHROME_PATHS = {
  win32: [
    process.env["LOCALAPPDATA"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["LOCALAPPDATA"] + "\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env["PROGRAMFILES"] + "\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
};

/** @type {import('child_process').ChildProcess | null} */
let chromeProcess = null;

/**
 * Finds the Chrome executable on the system
 * @returns {Promise<string | null>} Path to Chrome executable or null if not found
 */
export async function findChromeExecutable() {
  const currentPlatform = platform();
  const paths = CHROME_PATHS[currentPlatform] || CHROME_PATHS.linux;

  // First, check common paths
  for (const chromePath of paths) {
    if (chromePath && existsSync(chromePath)) {
      return chromePath;
    }
  }

  // On Linux, try to find using 'which' command
  if (currentPlatform === "linux" || currentPlatform === "darwin") {
    const commands = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"];
    for (const cmd of commands) {
      try {
        const { stdout } = await execAsync(`which ${cmd}`);
        const path = stdout.trim();
        if (path && existsSync(path)) {
          return path;
        }
      } catch {
        // Command not found, continue
      }
    }
  }

  // On Windows, try to find using 'where' command
  if (currentPlatform === "win32") {
    try {
      const { stdout } = await execAsync("where chrome");
      const path = stdout.trim().split("\n")[0];
      if (path && existsSync(path)) {
        return path;
      }
    } catch {
      // Command not found
    }
  }

  return null;
}

/**
 * Kills any existing Chrome processes with remote debugging on the specified port
 * @param {number} port - The debugging port
 */
export async function killExistingChromeDebug(port) {
  const currentPlatform = platform();

  try {
    if (currentPlatform === "win32") {
      // On Windows, use WMIC to find and kill processes
      await execAsync(`taskkill /F /FI "COMMANDLINE like *--remote-debugging-port=${port}*" 2>nul`).catch(() => {});
    } else {
      // On Unix-like systems, use pkill
      await execAsync(`pkill -f "remote-debugging-port=${port}" 2>/dev/null`).catch(() => {});
    }
    // Give processes time to terminate
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch {
    // Ignore errors - no process to kill
  }
}

/**
 * Checks if Chrome is ready for connection
 * @param {number} port - The debugging port
 * @returns {Promise<boolean>} True if Chrome is ready
 */
async function isChromeReady(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Launches Chrome with remote debugging enabled
 * @param {object} options - Launch options
 * @param {number} options.port - Remote debugging port
 * @param {string} options.userDataDir - Path to user data directory
 * @param {boolean} [options.headless] - Whether to run in headless mode
 * @returns {Promise<import('child_process').ChildProcess>} The Chrome process
 */
export async function launchChrome(options) {
  const { port, userDataDir, headless = false } = options;

  const chromePath = await findChromeExecutable();
  if (!chromePath) {
    throw new Error(
      "Could not find Chrome or Chromium installed.\n" +
        "Please install Google Chrome, Chromium, or Microsoft Edge.\n" +
        "Download Chrome: https://www.google.com/chrome/"
    );
  }

  console.log(`→ Found Chrome: ${chromePath}`);

  // Ensure user data directory exists
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  // Build Chrome arguments
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`];

  if (headless) {
    args.push("--headless=new");
  }

  console.log(`→ Starting Chrome with remote debugging on port ${port}...`);

  // Spawn Chrome process
  const currentPlatform = platform();
  /** @type {import('child_process').SpawnOptions} */
  const spawnOptions = {
    detached: currentPlatform !== "win32",
    stdio: /** @type {const} */ ("ignore"),
  };

  chromeProcess = spawn(chromePath, args, spawnOptions);

  // Handle process errors
  chromeProcess.on("error", (err) => {
    console.error("Chrome process error:", err.message);
  });

  // Don't let the Node.js process wait for Chrome to exit
  chromeProcess.unref();

  // Wait for Chrome to be ready
  console.log("→ Waiting for Chrome to be ready...");
  const maxAttempts = 30;
  let attempt = 0;

  while (attempt < maxAttempts) {
    if (await isChromeReady(port)) {
      console.log("✓ Chrome is ready!");
      return chromeProcess;
    }
    attempt++;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Chrome failed to start with remote debugging.");
}

/**
 * Gets the current Chrome process
 * @returns {import('child_process').ChildProcess | null}
 */
export function getChromeProcess() {
  return chromeProcess;
}

/**
 * Kills the Chrome process that was launched by this module
 */
export function killChrome() {
  if (chromeProcess && chromeProcess.pid) {
    try {
      // On Windows, we need to kill the process differently
      if (platform() === "win32") {
        spawn("taskkill", ["/pid", chromeProcess.pid.toString(), "/f", "/t"], { stdio: "ignore" });
      } else {
        process.kill(-chromeProcess.pid, "SIGTERM");
      }
    } catch {
      // Process might already be dead
    }
    chromeProcess = null;
  }
}
