#!/bin/bash

# Configuration
APP_NAME="scrape_tool-web"
# Get the root directory relative to the script location
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
PID_FILE="$ROOT_DIR/tmp/web.pid"
LOG_FILE="$ROOT_DIR/log/web.log"
WEB_DIR="$ROOT_DIR/web"

# Ensure directories exist
mkdir -p "$ROOT_DIR/tmp" "$ROOT_DIR/log"

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null; then
        echo "WebUI is already running with PID $PID."
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

echo "Starting $APP_NAME WebUI..."

# Navigate to web directory and start dev server in background
cd "$WEB_DIR" || exit 1
nohup npm run dev -- --host 0.0.0.0 > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "WebUI started with PID $(cat "$PID_FILE"). Logs at $LOG_FILE."
