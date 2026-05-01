#!/bin/bash

# Configuration
# Get the root directory relative to the script location
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
PID_FILE="$ROOT_DIR/tmp/web.pid"

echo "Stopping WebUI processes..."

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null; then
        echo "Terminating PID $PID and its descendants..."
        pkill -P "$PID" 2>/dev/null
        kill "$PID" 2>/dev/null
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

# Fallback: Force cleanup of common Vite ports to prevent "Address already in use" errors
# This is especially useful in dev environments with background processes
for port in 3000 3001 5173 5174; do
    PID_ON_PORT=$(lsof -t -i :$port 2>/dev/null)
    if [ ! -z "$PID_ON_PORT" ]; then
        echo "Force cleaning lingering process on port $port (PID: $PID_ON_PORT)"
        kill -9 "$PID_ON_PORT" 2>/dev/null
    fi
done

echo "WebUI stopped."
