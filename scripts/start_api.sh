#!/bin/bash

# Configuration
APP_NAME="scrape_tool"
PID_FILE="tmp/api.pid"
LOG_FILE="log/api.log"

# Navigate to project root if necessary
# Assuming execution from project root

# Ensure directories exist
mkdir -p tmp log

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null; then
        echo "API is already running with PID $PID."
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

echo "Starting $APP_NAME API..."

# Start the application in the background
# We use 'uv run python -m src.scrape_tool.main'
nohup uv run python -m src.scrape_tool.main > "$LOG_FILE" 2>&1 &

# Save the PID
echo $! > "$PID_FILE"

echo "API started with PID $(cat "$PID_FILE"). Logs at $LOG_FILE."
