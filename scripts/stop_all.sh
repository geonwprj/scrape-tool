#!/bin/bash

# Configuration
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Terminating Scraper Studio Ecosystem..."

# Stop WebUI first
if [ -f "$DIR/stop_web.sh" ]; then
    bash "$DIR/stop_web.sh"
else
    echo "WebUI stop script not found at $DIR/stop_web.sh"
fi

# Stop API
if [ -f "$DIR/stop_api.sh" ]; then
    bash "$DIR/stop_api.sh"
else
    echo "API stop script not found at $DIR/stop_api.sh"
fi

echo "All components terminated."
