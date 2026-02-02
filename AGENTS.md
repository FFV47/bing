# AGENTS.md - AI Coding Agent Instructions

Guidelines for AI coding agents working in this repository.

## Project Overview

Bing Auto-Search is a Node.js CLI application that automates Bing searches using Puppeteer with AI-powered search term generation via Google Gemini.

- **Language**: JavaScript (ES Modules) with TypeScript type checking
- **Runtime**: Node.js v18+
- **Package Manager**: pnpm (preferred), npm/yarn also supported

## Build/Lint/Test Commands

### Package Manager

Always use `pnpm` for package management: `pnpm install`

### Available Commands

| Command              | Description                                    |
|---------------------|------------------------------------------------|
| `pnpm start`        | Run the application (`node src/index.js`)      |
| `pnpm dev`          | Run in watch mode with auto-restart            |
| `pnpm lint`         | Run ESLint on the entire codebase              |
| `pnpm typecheck`    | Run TypeScript type checking (`tsc --noEmit`)  |

### Other Commands

```bash
./start.sh                        # Full startup: Chrome + term generation + app
node src/generateTermsGemini.js   # Generate AI search terms (requires GEMINI_API_KEY)
node src/index.js                 # Main entry point
```

### Pre-Commit Checks

Before committing, always run: `pnpm lint && pnpm typecheck`

## Code Style Guidelines

### Formatting (Prettier from package.json)

- **Semi**: `true` - Always use semicolons
- **Single Quote**: `false` - Use double quotes for strings
- **Print Width**: `120` characters
- **Tab Width**: `2` spaces
- **Trailing Comma**: `"es5"` - Trailing commas where valid in ES5
- **Quote Props**: `"preserve"` - Keep quote style as-is in objects

### Imports

1. **Order imports by category**: Node.js built-ins first (with `node:` prefix), external packages second, local modules last
2. **Use the `node:` prefix** for built-in modules: `import { readFileSync } from "node:fs";`
3. **Use `.js` extension** for local imports: `import { config } from "./config.js";`
4. **Named exports preferred** over default exports

### TypeScript / JSDoc

The project uses JavaScript with TypeScript checking (`allowJs: true`, `checkJs: true`).

- Use JSDoc for type annotations on all exported functions
- Use JSDoc for module-level type declarations: `/** @type {import('puppeteer').Browser | null} */`
- TypeScript config: `strict: true`, `noImplicitAny: false`, Target: `ES2024`, Module: `ESNext`

Example:
```javascript
/**
 * Gets a random interval between min and max configured values
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export async function sleep(ms) { ... }
```

### Naming Conventions

| Element           | Convention           | Example                      |
|-------------------|---------------------|------------------------------|
| Variables         | camelCase           | `searchCount`, `termIndex`   |
| Functions         | camelCase           | `performSearch`, `getPage`   |
| Constants         | SCREAMING_SNAKE_CASE| `MAX_RETRY_ATTEMPTS`         |
| Exported constants| camelCase           | `config`, `SEARCH_TERMS_PATH`|
| File names        | camelCase           | `generateTermsGemini.js`     |

### Error Handling

1. Wrap main execution in try-catch with `process.exit(1)` on fatal errors
2. Extract error messages safely: `const errorMessage = error instanceof Error ? error.message : String(error);`
3. Use console output with status indicators: `✓` (success), `✗` (failure), `→` (progress)
4. Implement retry logic for network operations with configurable attempts
5. Handle `SIGINT` for graceful shutdown and resource cleanup

### Async/Await

- Always use `async/await` over raw Promises
- Handle promise rejections with try-catch

### Module Pattern

- Use ES Modules (`"type": "module"` in package.json)
- Export functions and constants explicitly
- Keep module-level state minimal and well-documented

## Project Structure

```
src/
├── index.js              # Main entry point and search loop
├── browser.js            # Puppeteer browser utilities
├── search.js             # Search automation logic
├── config.js             # Application configuration
├── utils.js              # Utility functions
├── generateTermsGemini.js # AI search term generation
└── generated/            # Generated files (gitignored)
```

## ESLint Configuration

Uses ESLint v9 flat config with TypeScript checking. Disabled rules:

- `@typescript-eslint/no-misused-promises`
- `@typescript-eslint/no-unsafe-argument`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/ban-ts-comment`

## Environment Variables

| Variable        | Required | Description                    |
|----------------|----------|--------------------------------|
| `GEMINI_API_KEY`| Yes      | Google Gemini API key for term generation |

## Important Notes

1. **Chrome must be running** with remote debugging before starting:
   ```bash
   google-chrome --remote-debugging-port=9222
   ```

2. **Generated files** in `src/generated/` are gitignored

3. **The `chrome-user-data/` directory** stores Chrome profile data and is gitignored

4. **Security**: The `.npmrc` file has `ignore-scripts=true` to prevent malicious post-install scripts
