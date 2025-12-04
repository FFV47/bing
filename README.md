# Bing Auto-Search

An automation application that opens a browser and performs searches on Bing at random intervals. Built with Node.js and Puppeteer.

## Features

- 🔍 Automated Bing searches with randomized intervals
- ⌨️ Human-like typing simulation
- 📜 Smooth page scrolling behavior
- 🔄 Configurable search terms with auto-generation
- 🌐 Connects to an existing Chrome instance via remote debugging
- ⚙️ Fully customizable configuration

## Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (or npm/yarn)
- Google Chrome or Chromium browser

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
| `searchTerms`     | `[...]`                | Array of search terms to cycle through            |

## Scripts

| Command                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `pnpm start`                     | Run the application                      |
| `pnpm dev`                       | Run in watch mode (auto-restart on save) |
| `node scripts/generate-terms.js` | Generate new random search terms         |

## How It Works

1. The application connects to Chrome via the DevTools Protocol (CDP)
2. Opens a new tab and navigates to Bing
3. Performs a search with human-like typing behavior
4. Scrolls through results naturally
5. Waits a random interval (between min and max configured values)
6. Repeats until the maximum number of searches is reached

## License

GNU AGPLv3
