#!/bin/bash

# Configuration
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Starting Scraper Studio Ecosystem..."

# Start API
if [ -f "$DIR/start_api.sh" ]; then
    bash "$DIR/start_api.sh"
else
    echo "API start script not found at $DIR/start_api.sh"
fi

# Start WebUI
if [ -f "$DIR/start_web.sh" ]; then
    bash "$DIR/start_web.sh"
else
    echo "WebUI start script not found at $DIR/start_web.sh"
fi

echo "All components initiated. Check logs in log/ directory."
