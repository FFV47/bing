# Copilot Instructions for Bing Auto-Search

## Project Overview

This is a Node.js automation tool that performs Bing searches at random intervals using Puppeteer. It connects to an existing Chrome instance via remote debugging and uses Google Gemini AI to generate trending search terms in Portuguese.

## Architecture

```
src/
├── index.js          # Main entry point, orchestrates the search loop
├── config.js         # Centralized configuration (intervals, ports, URLs)
├── browser.js        # Puppeteer browser/page lifecycle management
├── search.js         # Search execution with retry logic and human-like behavior
├── utils.js          # Utility functions (intervals, sleep, formatting)
├── generateTermsGemini.js  # AI-powered search term generation
└── generated/        # Runtime-generated files (search-terms.json)
```

**Key Data Flow:**

1. `generateTermsGemini.js` → Gemini API → `generated/search-terms.json`
2. `index.js` reads terms → `browser.js` manages Chrome connection → `search.js` executes searches

## Code Conventions

- **ES Modules only** - Uses `import`/`export`, not CommonJS (`"type": "module"`)
- **JSDoc for types** - TypeScript is used only for type checking (`pnpm typecheck`), not compilation
- **Human-like simulation** - Searches include typing delays, scrolling, and random intervals to mimic real behavior
- **Graceful handling** - Browser disconnects trigger automatic reconnection (see `performSearchWithRetry` pattern)

## Development Commands

```bash
./start.sh          # Full workflow: generate terms → start Chrome → run app
pnpm dev            # Watch mode (requires Chrome already running with --remote-debugging-port=9222)
pnpm lint           # ESLint with TypeScript type checking
pnpm typecheck      # TypeScript type validation only
```

## Key Patterns

### Browser Connection Pattern

The app connects to an **existing** Chrome instance, not launching its own:

```javascript
// browser.js - Connect via CDP, don't launch
browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${config.chromeDebugPort}`,
});
```

### Retry with Reconnection

All searches use `performSearchWithRetry()` which handles Chrome disconnections:

```javascript
// search.js - Retry pattern for disconnection handling
if (!isBrowserConnected()) {
  await reconnectBrowser(RETRY_DELAY_MS);
}
```

### Gemini JSON Schema Validation

Search term generation uses Zod schemas for type-safe AI responses:

```javascript
// generateTermsGemini.js
const SearchTermsSchema = z.array(z.string());
const response = await ai.models.generateContent({
  config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema },
});
```

## Environment Requirements

- `GEMINI_API_KEY` environment variable is required for search term generation
- Chrome must be started with `--remote-debugging-port=9222` (handled by `start.sh`)
- Generated files go to `src/generated/` (gitignored)

## Important Files

- [src/config.js](src/config.js) - All tunable parameters (intervals, delays, max searches)
- [start.sh](start.sh) - Production startup script with retry logic for term generation
- [chrome-user-data/](chrome-user-data/) - Chrome profile persisted between sessions (gitignored contents)

## Testing Notes

No test framework is configured. Manual testing is done via `pnpm dev` with Chrome running in debug mode.
