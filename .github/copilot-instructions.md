# Bing Auto-Search - Copilot Instructions

## Project Overview

A Puppeteer-based automation tool that performs Bing searches with human-like behavior (typing simulation, smooth scrolling, random intervals). Built for educational/personal use.

## Architecture

```
src/
├── index.js    # Main entry point - browser automation, search loop, graceful shutdown
├── config.js   # All configurable parameters (intervals, search terms, ports)
scripts/
├── generate-terms.js  # Generates random search terms by combining word categories
start.sh        # Full startup workflow (Chrome + term generation + app)
```

**Key Flow:**

1. `start.sh` launches Chrome with `--remote-debugging-port=9222`
2. Puppeteer connects via CDP (not launching its own browser)
3. Performs searches with typing delay → scroll down → scroll up → random wait
4. Cycles through `config.searchTerms` until `maxSearches` reached

## Developer Workflow

```bash
# Quick start (recommended) - handles Chrome, generates terms, runs app
./start.sh

# Development with auto-restart
pnpm dev

# Generate new random search terms (updates config.js in-place)
node scripts/generate-terms.js

# Manual Chrome launch (if not using start.sh)
google-chrome --remote-debugging-port=9222 --user-data-dir=./chrome-user-data
```

## Code Patterns

### Browser Connection

```javascript
// Connect to existing Chrome, don't launch new instance
browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${config.chromeDebugPort}`,
  defaultViewport: null,
});
```

### Human-like Behavior

- Typing: `page.type(selector, text, { delay: config.typingDelayMs })`
- Scrolling: Custom `smoothScroll()` using `requestAnimationFrame` with easing
- Intervals: Random between `minIntervalMs` and `maxIntervalMs`

### JSDoc Types

Use JSDoc for Puppeteer types to enable IntelliSense:

```javascript
/** @type {import('puppeteer').Browser | null} */
let browser = null;
```

### Graceful Shutdown

Always handle `SIGINT` to close tabs and disconnect (not close) browser.

## Configuration (`src/config.js`)

| Option                            | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `minIntervalMs` / `maxIntervalMs` | Random wait range between searches            |
| `maxSearches`                     | Stop after N searches (0 = unlimited)         |
| `typingDelayMs`                   | Milliseconds between keystrokes               |
| `chromeDebugPort`                 | Must match Chrome's `--remote-debugging-port` |
| `searchTerms`                     | Auto-generated array - don't edit manually    |

## Search Term Generation

`scripts/generate-terms.js` combines word categories (adjectives, topics, subjects, actions, places, timeframes) using templates. Updates `config.js` directly via regex replacement.

## Important Constraints

- **Chrome user data**: Stored in `chrome-user-data/` for persistent sessions (login state, cookies)
- **Port 9222**: Default debug port - must be free before starting
- **ES Modules**: Project uses `"type": "module"` - use `import`/`export` only
- **No tests**: Project has no test suite currently
