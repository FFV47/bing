# Bing Auto-Search

An automation application that opens a browser and performs searches on Bing at random intervals.
Built with Node.js and Puppeteer, with AI-powered search term generation using Google Gemini.

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
- 🤖 AI-powered search term generation using Google Gemini (based on trending topics)
- ⌨️ Human-like typing simulation
- 📜 Smooth page scrolling behavior
- ⚙️ Fully customizable configuration

## Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (or npm/yarn)
- Google Chrome or Chromium browser
- Google Gemini API key (set as `GEMINI_API_KEY` environment variable)

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

## Usage

### Quick Start (Recommended)

Use the included startup script that handles everything automatically:

```bash
./start.sh
```

This script will:

1. Close any existing Chrome debug instances
2. Start Chrome with remote debugging enabled
3. Generate fresh random search terms
4. Run the auto-search application
5. Clean up when finished

## Configuration

Edit `src/config.js` to customize the behavior:

| Option            | Default                | Description                                       |
| ----------------- | ---------------------- | ------------------------------------------------- |
| `minIntervalMs`   | `180000` (3m)          | Minimum interval between searches (milliseconds)  |
| `maxIntervalMs`   | `300000` (5m)          | Maximum interval between searches (milliseconds)  |
| `maxSearches`     | `30`                   | Maximum number of searches (0 = unlimited)        |
| `typingDelayMs`   | `200`                  | Delay between keystrokes (simulates human typing) |
| `chromeDebugPort` | `9222`                 | Chrome remote debugging port                      |
| `bingBaseUrl`     | `https://www.bing.com` | Bing homepage URL                                 |

### Environment Variables

| Variable         | Required | Description                                           |
| ---------------- | -------- | ----------------------------------------------------- |
| `GEMINI_API_KEY` | Yes      | Your Google Gemini API key for search term generation |

## Scripts

| Command                           | Description                               |
| --------------------------------- | ----------------------------------------- |
| `pnpm start`                      | Run the application                       |
| `pnpm dev`                        | Run in watch mode (auto-restart on save)  |
| `node src/generateTermsGemini.js` | Generate new search terms using Gemini AI |

## How It Works

1. **Search Term Generation**: Uses Google Gemini AI to generate trending search terms in Portuguese
2. The startup script launches Chrome with remote debugging enabled
3. Connects to Chrome via the DevTools Protocol (CDP) using Puppeteer
4. Opens a new tab and navigates to Bing
5. Performs searches with human-like typing behavior
6. Scrolls through results naturally
7. Waits a random interval (between min and max configured values)
8. Repeats until the maximum number of searches is reached

## License

GNU AGPLv3
