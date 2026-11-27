#!/bin/bash

# Bing Auto-Search Startup Script
# Generates search terms, starts Chrome with remote debugging, and runs the app.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEBUG_PORT="${CHROME_DEBUG_PORT:-9222}"
USER_DATA_DIR="$SCRIPT_DIR/chrome-user-data"
CHROME_PID=""
CLEANED_UP=false

# Parse CLI flags we need to inspect while keeping all arguments intact for Node.
MOBILE_MODE=false
HELP_REQUESTED=false
EXPECT_PORT=false

for arg in "$@"; do
  if [ "$EXPECT_PORT" = true ]; then
    DEBUG_PORT="$arg"
    EXPECT_PORT=false
    continue
  fi

  case "$arg" in
    --mobile|-m)
      MOBILE_MODE=true
      ;;
    --help|-h)
      HELP_REQUESTED=true
      ;;
    --port)
      EXPECT_PORT=true
      ;;
    --port=*)
      DEBUG_PORT="${arg#--port=}"
      ;;
  esac
done

export CHROME_DEBUG_PORT="$DEBUG_PORT"

if [ "$HELP_REQUESTED" = true ]; then
  node "$SCRIPT_DIR/src/index.js" --help
  exit 0
fi

if [ "$MOBILE_MODE" = true ]; then
  MODE_LABEL="Mobile"
  TERMS_FILE="$SCRIPT_DIR/src/generated/search-terms-mobile.json"
else
  MODE_LABEL="Desktop"
  TERMS_FILE="$SCRIPT_DIR/src/generated/search-terms-desktop.json"
fi

cleanup() {
  if [ "$CLEANED_UP" = true ]; then
    return
  fi
  CLEANED_UP=true

  if [ -n "$CHROME_PID" ] && kill -0 "$CHROME_PID" 2>/dev/null; then
    echo ""
    echo "→ Stopping Chrome (PID $CHROME_PID)..."
    kill "$CHROME_PID" 2>/dev/null || true
    wait "$CHROME_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

check_chrome_ready() {
  local url="http://127.0.0.1:$DEBUG_PORT/json/version"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$url" >/dev/null 2>&1
  else
    node -e "fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" "$url" >/dev/null 2>&1
  fi
}

echo "╔═════════════════════════════════════════════╗"
echo "║   Bing Auto-Search Startup Script ($MODE_LABEL) ║"
echo "╚═════════════════════════════════════════════╝"
echo ""

# Exit code the term generator uses for configuration errors (EX_CONFIG)
EXIT_CONFIG_ERROR=78

# Verify the Gemini API key before doing any work. The @google/genai SDK reads
# GOOGLE_API_KEY first, then GEMINI_API_KEY.
if [ -z "${GOOGLE_API_KEY:-}" ] && [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "✗ Error: GEMINI_API_KEY is not set."
  echo ""
  echo "  A Google Gemini API key is required to generate search terms."
  echo "  1. Create a key at https://aistudio.google.com/apikey"
  echo "  2. Export it before running this script:"
  echo "       export GEMINI_API_KEY=\"your-key-here\""
  echo "  3. To persist it, add that line to ~/.bashrc (or ~/.zshrc) and reopen the shell."
  echo ""
  echo "  Aborting operation."
  exit 1
fi

# Generate search terms first
echo "→ Generating fresh search terms using Gemini AI..."

MAX_TERM_ATTEMPTS=3
TERM_ATTEMPT=0
TERMS_GENERATED=false

while [ "$TERM_ATTEMPT" -lt "$MAX_TERM_ATTEMPTS" ]; do
  TERM_ATTEMPT=$((TERM_ATTEMPT + 1))
  echo "Attempt $TERM_ATTEMPT of $MAX_TERM_ATTEMPTS..."

  node "$SCRIPT_DIR/src/generateTermsGemini.js" "$@"
  GENERATE_STATUS=$?

  # A misconfiguration will not fix itself on retry — abort immediately.
  if [ "$GENERATE_STATUS" -eq "$EXIT_CONFIG_ERROR" ]; then
    echo "  Aborting operation."
    exit 1
  fi

  if [ "$GENERATE_STATUS" -eq 0 ] && [ -f "$TERMS_FILE" ]; then
    echo "✓ Search terms generated successfully!"
    TERMS_GENERATED=true
    break
  fi

  if [ "$TERM_ATTEMPT" -lt "$MAX_TERM_ATTEMPTS" ]; then
    echo "✗ Failed to generate terms (exit code $GENERATE_STATUS). Waiting 30 seconds before retry..."
    sleep 30
  fi
done

if [ "$TERMS_GENERATED" = false ]; then
  echo "✗ Error: Failed to generate search terms after $MAX_TERM_ATTEMPTS attempts."
  echo "  Aborting operation."
  exit 1
fi

echo ""

# Close any existing Chrome instance belonging specifically to this project's profile
echo "→ Closing any existing project debug Chrome instances..."
pkill -f "user-data-dir=$USER_DATA_DIR" 2>/dev/null || true
sleep 1

# Find the Chrome executable
CHROME_CMD=""
for cmd in google-chrome-stable google-chrome chromium chromium-browser; do
  if command -v "$cmd" >/dev/null 2>&1; then
    CHROME_CMD="$cmd"
    break
  fi
done

if [ -z "$CHROME_CMD" ]; then
  echo "✗ Error: Could not find Chrome or Chromium installed."
  echo "  Please install Google Chrome or Chromium."
  exit 1
fi

echo "→ Found Chrome: $CHROME_CMD"

# Start Chrome with remote debugging
echo "→ Starting Chrome with remote debugging on port $DEBUG_PORT..."
"$CHROME_CMD" --remote-debugging-port="$DEBUG_PORT" --user-data-dir="$USER_DATA_DIR" >/dev/null 2>&1 &
CHROME_PID=$!

# Wait for Chrome to be ready
echo "→ Waiting for Chrome to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
  if check_chrome_ready; then
    echo "✓ Chrome is ready!"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 0.5
done

if [ "$ATTEMPT" -eq "$MAX_ATTEMPTS" ]; then
  echo "✗ Error: Chrome failed to start with remote debugging on port $DEBUG_PORT."
  exit 1
fi

echo ""
echo "→ Starting Bing Auto-Search application ($MODE_LABEL mode)..."
echo ""

cd "$SCRIPT_DIR" || exit 1

if command -v pnpm >/dev/null 2>&1; then
  APP_CMD=(pnpm start -- "$@")
else
  APP_CMD=(node "$SCRIPT_DIR/src/index.js" "$@")
fi

# Inhibit idle/screen-off while the app runs (Wayland/systemd)
APP_STATUS=0
if command -v systemd-inhibit >/dev/null 2>&1; then
  echo "→ Screen idle inhibitor active (systemd-inhibit)"
  systemd-inhibit --what=idle --who="bing-auto-search" --why="Automated Bing searches in progress" --mode=block \
    "${APP_CMD[@]}" || APP_STATUS=$?
elif command -v gnome-session-inhibit >/dev/null 2>&1; then
  echo "→ Screen idle inhibitor active (gnome-session-inhibit)"
  gnome-session-inhibit --inhibit idle --reason "Automated Bing searches in progress" \
    "${APP_CMD[@]}" || APP_STATUS=$?
else
  echo "⚠ Warning: No idle inhibitor found. Screen may turn off during execution."
  echo "  Install systemd or run: gsettings set org.gnome.desktop.session idle-delay 0"
  "${APP_CMD[@]}" || APP_STATUS=$?
fi

echo ""
echo "→ Application stopped (exit code $APP_STATUS)."
cleanup
echo "Done!"
exit "$APP_STATUS"
