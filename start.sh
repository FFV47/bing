#!/bin/bash

# Bing Auto-Search Startup Script
# This script starts Chrome with remote debugging and then runs the app

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEBUG_PORT=9222
USER_DATA_DIR="$SCRIPT_DIR/chrome-user-data"

echo "╔════════════════════════════════════════════╗"
echo "║     Bing Auto-Search Startup Script        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Kill any existing Chrome instances with remote debugging
echo "→ Closing any existing debug Chrome instances..."
pkill -f "remote-debugging-port=$DEBUG_PORT" 2>/dev/null
sleep 1

# Find the Chrome executable
CHROME_CMD=""
for cmd in google-chrome-stable google-chrome chromium chromium-browser; do
    if command -v "$cmd" &> /dev/null; then
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
"$CHROME_CMD" --remote-debugging-port=$DEBUG_PORT --user-data-dir="$USER_DATA_DIR" > /dev/null 2>&1 &
CHROME_PID=$!

# Wait for Chrome to be ready
echo "→ Waiting for Chrome to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s "http://127.0.0.1:$DEBUG_PORT/json/version" > /dev/null 2>&1; then
        echo "✓ Chrome is ready!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 0.5
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "✗ Error: Chrome failed to start with remote debugging."
    kill $CHROME_PID 2>/dev/null
    exit 1
fi

echo ""
echo "→ Generating fresh search terms..."
node scripts/generate-terms.js
echo ""
echo "→ Starting Bing Auto-Search application..."
echo ""

# Change to the script's directory and run the app
cd "$(dirname "$0")"
npm start

# When the app exits, optionally close Chrome
echo ""
echo "→ Application stopped."
# read -p "Close Chrome? (y/n): " CLOSE_CHROME
# if [ "$CLOSE_CHROME" = "y" ] || [ "$CLOSE_CHROME" = "Y" ]; then
#     echo "→ Closing Chrome..."
# fi

kill $CHROME_PID 2>/dev/null
echo "Done!"
