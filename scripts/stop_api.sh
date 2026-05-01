#!/bin/bash

# Configuration
PID_FILE="tmp/api.pid"

# Navigate to project root if necessary

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null; then
        echo "Stopping API with PID $PID..."
        kill "$PID"
        # Force cleanup port 8000 if still active
        fuser -k 8000/tcp 2>/dev/null
        # Wait for PID cleanup
        rm -f "$PID_FILE"
        echo "API stopped."
    else
        echo "No running API found for PID $PID. Cleaning up stale PID file."
        rm -f "$PID_FILE"
    fi
else
    echo "No PID file found. API might not be running."
fi
