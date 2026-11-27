# Bing Auto-Search

An automation application that opens a browser and performs searches on Bing at random intervals.
Built with Node.js and `puppeteer-core`, with AI-powered search term generation using Google Gemini.

## Disclaimer

⚠️ **Use at your own risk.** Microsoft Bing's Terms of Use is governed by the [Microsoft Services Agreement](https://www.microsoft.com/en-us/servicesagreement/). By using this application, you acknowledge and agree to the following:

- This application **may violate the terms of service of Microsoft Bing or any related services.**
- Using automation tools on third-party services **may violate their terms of use**.
- You should review and comply with all applicable terms of use before using this application.
- This application assists with Bing searches and Bing Rewards activities **only when manually triggered or scheduled by you**. No automation runs on its own unless explicitly configured.
- This application is an independent tool and is **not affiliated, endorsed, or sponsored by Microsoft, Bing, or any of their subsidiaries**.
- You alone are responsible for any actions taken using this application, including any potential
  account consequences.
- This application is intended **for educational or personal productivity purposes only**. Misuse for spamming, abuse, or policy violations is strongly discouraged and not supported.
- If you do not agree, please refrain from using this application.

## Features

- 🔍 Automated Bing searches with randomized intervals
- 📱 Mobile mode support (viewport, touch, User-Agent, and User-Agent Client Hints)
- 🤖 AI-powered evergreen search term generation using Google Gemini with rolling deduplication history
- ⌨️ Human-like typing simulation with randomized keystroke jitter
- 📜 Smooth page scrolling resilient to background/screen-off throttling
- ⚙️ Configurable via defaults, environment variables (`.env`), and CLI flags

## Prerequisites

- Node.js `>=22.12.0`
- pnpm `12+`
- Google Chrome or Chromium browser
- Google Gemini API key (`GEMINI_API_KEY`, or use the offline fallback scripts)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/FFV47/bing.git
   cd bing
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set your Gemini API key:

   ```bash
   export GEMINI_API_KEY="your-key-here"
   ```

   Create a key at [Google AI Studio](https://aistudio.google.com/apikey). Add the
   line to `~/.bashrc` (or `~/.zshrc`) to persist it across shells, or place it in a
   local `.env` file (ignored by Git).

   The Gemini generator refuses to start without a key — it will not attempt any API
   calls and will tell you how to set one.

4. (Contributors) Enable the project's git hooks and branch aliases. The hooks block direct commits to `main`, and
   commits and pushes on branches that break the [Conventional Branch](https://conventionalbranch.org/) naming rules.
   The commit check runs [commit-check](https://github.com/commit-check/commit-check) through `uvx`, so it needs
   [uv](https://docs.astral.sh/uv/).

   ```bash
   git config core.hooksPath .githooks
   git config include.path ../.gitconfig   # git feature add login page -> feature/add-login-page
   ```

## Usage

### Quick Start (Recommended)

Use the included startup script that handles everything automatically:

```bash
./start.sh
```

You can pass CLI options directly through `start.sh` (for example `./start.sh --mobile --mobile-max-searches 15 --port 9222`).

This script will:

1. Validate `GEMINI_API_KEY` and generate fresh search terms via Gemini AI
2. Close any existing project debug Chrome instance (`chrome-user-data`)
3. Start Chrome with remote debugging enabled
4. Run the auto-search application (with idle inhibition when available)
5. Stop the Chrome instance cleanly on exit or `Ctrl+C`

## Configuration

Defaults live in [src/config.js](src/config.js) and can be overridden with environment variables (including a local `.env` file) or CLI flags (**CLI > env > defaults**). All configuration values are validated at startup with Zod.

| Option                    | Default                  | Environment Variable       | CLI Flag                | Description                                                |
| ------------------------- | ------------------------ | -------------------------- | ----------------------- | ---------------------------------------------------------- |
| `minIntervalMs`           | `60000` (1m)             | `BING_MIN_INTERVAL_MS`     | `--min-interval`        | Minimum interval between searches (milliseconds)           |
| `maxIntervalMs`           | `120000` (2m)            | `BING_MAX_INTERVAL_MS`     | `--max-interval`        | Maximum interval between searches (milliseconds)           |
| `maxSearches`             | `20`                     | `BING_MAX_SEARCHES`        | `--max-searches`        | Maximum desktop searches (`0` = unlimited)                 |
| `mobile.maxSearches`      | `20`                     | `BING_MOBILE_MAX_SEARCHES` | `--mobile-max-searches` | Maximum mobile searches (`0` = unlimited)\*                |
| `defaultTermCount`        | `30`                     | `BING_DEFAULT_TERM_COUNT`  | —                       | Terms generated when `maxSearches` is `0`                  |
| `termHistoryLimit`        | `150`                    | `BING_TERM_HISTORY_LIMIT`  | —                       | Rolling history size kept to prevent repeat terms          |
| `searchLanguage`          | `"Brazilian Portuguese"` | `BING_SEARCH_LANGUAGE`     | `--lang`                | Language requested when generating terms                   |
| `typingDelayMs`           | `200`                    | `BING_TYPING_DELAY_MS`     | `--typing-delay`        | Base delay between keystrokes (milliseconds)               |
| `behavior.typingJitterMs` | `80`                     | `BING_TYPING_JITTER_MS`    | —                       | Random `±` jitter applied to each keystroke (milliseconds) |
| `chromeDebugPort`         | `9222`                   | `CHROME_DEBUG_PORT`        | `--port`                | Chrome remote debugging port                               |
| `bingBaseUrl`             | `https://www.bing.com`   | `BING_BASE_URL`            | —                       | Bing homepage URL                                          |

\*When running with `--mobile` and `--mobile-max-searches` is not specified, `--max-searches` also acts as a fallback override for the current mobile run.

Additional human-like timing ranges (`preSubmitDelayMs`, `preScrollDelayMs`, `scrollDownDurationMs`, `bottomPauseMs`, `scrollUpDurationMs`) and mobile emulation settings (`mobile.userAgent`, `mobile.userAgentMetadata`, `mobile.viewport`) can also be tuned in [src/config.js](src/config.js).

### API Key Environment Variables

| Variable         | Required | Description                                                         |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Yes\*    | Your Google Gemini API key for search term generation               |
| `GOOGLE_API_KEY` | No       | Alternative to `GEMINI_API_KEY`; takes precedence when both are set |

\*Only required for Gemini term generation. For offline term generation without an API key, see the fallback scripts below.

## Scripts

| Command                               | Description                                       |
| ------------------------------------- | ------------------------------------------------- |
| `pnpm start`                          | Run the application (desktop mode)                |
| `pnpm start -- --mobile`              | Run the application in mobile mode                |
| `pnpm start -- --help`                | Show available CLI flags                          |
| `pnpm dev`                            | Run in watch mode (auto-restart on save)          |
| `pnpm run generate`                   | Generate desktop search terms using Gemini AI     |
| `pnpm run generate:mobile`            | Generate mobile search terms using Gemini AI      |
| `node scripts/generate-terms-ptbr.js` | Offline fallback generator (PT-BR, supports `-m`) |
| `node scripts/generate-terms.js`      | Offline fallback generator (EN, supports `-m`)    |
| `pnpm test`                           | Run unit tests (`node --test`)                    |
| `pnpm run lint`                       | Run ESLint                                        |
| `pnpm run typecheck`                  | Run TypeScript type checks (`tsc --noEmit`)       |
| `pnpm run format:check`               | Verify Prettier formatting                        |
| `pnpm run format`                     | Format files with Prettier                        |

### Mobile Mode

To earn mobile Bing Rewards points, run the application with the `--mobile` or `-m` flag:

```bash
# Full flow via startup script
./start.sh --mobile

# Or directly with pnpm
pnpm start -- --mobile
```

Mobile mode emulates an Android Chrome browser by:

- Configuring a mobile viewport with touch support (`412×915`, `deviceScaleFactor: 2.625`)
- Setting an Android Chrome `User-Agent` along with matching User-Agent Client Hints (`Sec-CH-UA*`)

**Tip:** Run desktop searches first, then run mobile searches separately to maximize your Bing Rewards points.

## How It Works

1. **Search Term Generation**: Uses Google Gemini AI (with automatic model fallback and Zod validation) to generate evergreen, realistic search terms while avoiding duplicates from the rolling history in `src/generated/`
2. The startup script launches Chrome with remote debugging enabled and a dedicated profile (`chrome-user-data/`)
3. Connects to Chrome over the DevTools Protocol (CDP) using `puppeteer-core`
4. Reuses an open tab (or creates one if none is open) and navigates to Bing
5. Performs searches with randomized keystroke jitter and pauses
6. Scrolls smoothly through results (with a timer fallback so it does not stall when the screen turns off)
7. Waits a random interval between `minIntervalMs` and `maxIntervalMs`
8. Repeats until `maxSearches` is reached or `SIGINT`/`SIGTERM` is received

## License

GNU AGPLv3 ([License.txt](License.txt))
