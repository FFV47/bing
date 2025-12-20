# Bing Auto-Search

A cross-platform automation application that opens a browser and performs searches on Bing at random intervals.
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
- 🖥️ **Cross-platform** - works on Windows, macOS, and Linux

## Prerequisites

- Node.js (v18 or higher)
- Google Chrome, Chromium, or Microsoft Edge browser
- Google Gemini API key (set as `GEMINI_API_KEY` environment variable)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/FFV47/bing.git
   cd bing
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the application:

   ```bash
   npm run build
   ```

## Usage

### Quick Start

Set your Gemini API key and run the application:

```bash
# Set your API key (Linux/macOS)
export GEMINI_API_KEY=your_api_key_here

# Set your API key (Windows PowerShell)
$env:GEMINI_API_KEY="your_api_key_here"

# Set your API key (Windows CMD)
set GEMINI_API_KEY=your_api_key_here

# Run the application
npm start
```

The application will:

1. Generate fresh search terms using Gemini AI
2. Launch Chrome with remote debugging enabled
3. Perform automated Bing searches
4. Clean up when finished

### Development Mode

Run directly from source with auto-restart on changes:

```bash
npm run dev
```

## Configuration

Configuration can be customized via environment variables:

| Environment Variable   | Default                | Description                                       |
| ---------------------- | ---------------------- | ------------------------------------------------- |
| `GEMINI_API_KEY`       | (required)             | Your Google Gemini API key                        |
| `MIN_INTERVAL_MINUTES` | `3`                    | Minimum interval between searches (minutes)       |
| `MAX_INTERVAL_MINUTES` | `5`                    | Maximum interval between searches (minutes)       |
| `MAX_SEARCHES`         | `30`                   | Maximum number of searches (0 = unlimited)        |
| `TYPING_DELAY_MS`      | `200`                  | Delay between keystrokes (simulates human typing) |
| `CHROME_DEBUG_PORT`    | `9222`                 | Chrome remote debugging port                      |
| `CHROME_USER_DATA_DIR` | `./chrome-user-data`   | Chrome user data directory                        |
| `BING_BASE_URL`        | `https://www.bing.com` | Bing homepage URL                                 |

### Example with Custom Configuration

```bash
# Linux/macOS
export GEMINI_API_KEY=your_api_key
export MAX_SEARCHES=50
export MIN_INTERVAL_MINUTES=2
export MAX_INTERVAL_MINUTES=4
npm start

# Windows PowerShell
$env:GEMINI_API_KEY="your_api_key"
$env:MAX_SEARCHES="50"
npm start
```

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm start`         | Run the built application         |
| `npm run dev`       | Run from source with auto-restart |
| `npm run build`     | Build the application with Vite   |
| `npm run lint`      | Run ESLint                        |
| `npm run typecheck` | Run TypeScript type checking      |

## How It Works

1. **Search Term Generation**: Uses Google Gemini AI to generate trending search terms in Portuguese
2. Automatically finds and launches Chrome/Chromium/Edge with remote debugging
3. Connects to Chrome via the DevTools Protocol (CDP) using Puppeteer
4. Opens a new tab and navigates to Bing
5. Performs searches with human-like typing behavior
6. Scrolls through results naturally
7. Waits a random interval (between min and max configured values)
8. Repeats until the maximum number of searches is reached

## License

GNU AGPLv3
