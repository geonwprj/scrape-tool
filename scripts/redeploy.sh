#!/bin/bash

# Configuration
PROJECT_NAME="scrape-tool"
API_PORT=28001
WEBUI_PORT=23001

echo "🚀 Starting redeployment for $PROJECT_NAME..."

# 1. Kill dangling rootlessport processes for the target ports
echo "🧹 Checking for dangling rootlessport processes..."
for port in $API_PORT $WEBUI_PORT; do
    PID=$(ps aux | grep rootlessport | grep "$port" | awk '{print $2}')
    if [ ! -z "$PID" ]; then
        echo "🚨 Killing dangling rootlessport on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null
    fi
done

# General cleanup of rootlessport if they are stuck
# (Use with caution, but often necessary in rootless podman)
# PID_GENERAL=$(ps aux | grep rootlessport | grep -v grep | awk '{print $2}')
# if [ ! -z "$PID_GENERAL" ]; then
#     echo "🧹 Cleaning up generic rootlessport processes..."
#     kill -9 $PID_GENERAL 2>/dev/null
# fi

# 2. Stop and remove existing containers
echo "🛑 Stopping existing containers..."
podman-compose down

# 3. Rebuild and start
echo "🏗️ Rebuilding and starting containers..."
podman-compose up -d --build

# 4. Verify status
echo "📊 Current Container Status:"
podman ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep $PROJECT_NAME

echo "✅ Redeployment complete!"
