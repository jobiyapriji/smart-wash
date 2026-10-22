#!/usr/bin/env bash
# SMART WASH — Production Orchestration Script (Linux/macOS)
set -e

echo "==================================================="
echo "[SMART WASH] Starting Production Stack via Docker..."
echo "==================================================="

# Verify Docker is available
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    echo "Please install Docker and Docker Compose."
    exit 1
fi

echo "Building and starting containers in background..."
docker compose up -d --build

echo "Waiting for services to become healthy..."
sleep 5

echo "==================================================="
echo "[SUCCESS] SMART WASH is running in production!"
echo "- Kiosk & Dashboard: http://localhost:80 (or port 3000)"
echo "- AI Backend Health: http://localhost:4550/health"
echo "- AI Model Readiness: http://localhost:4550/ready"
echo "==================================================="
