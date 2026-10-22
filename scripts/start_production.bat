@echo off
REM SMART WASH — Production Orchestration Script (Windows)
echo ===================================================
echo [SMART WASH] Starting Production Stack via Docker...
echo ===================================================

REM Check for Docker
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed or not in PATH!
    echo Please install Docker Desktop for Windows or run standalone mode via:
    echo   1. py -m uvicorn backend.main:app --port 4550
    echo   2. npm run build ^&^& npx serve -s dist -l 80
    pause
    exit /b 1
)

REM Build and run containers in detached mode
echo Building and starting containers...
docker compose up -d --build

if %ERRORLEVEL% EQU 0 (
    echo ===================================================
    echo [SUCCESS] SMART WASH is running in production!
    echo - Kiosk & Dashboard: http://localhost:80 (or port 3000)
    echo - AI Backend Health: http://localhost:4550/health
    echo - AI Model Readiness: http://localhost:4550/ready
    echo ===================================================
) else (
    echo [ERROR] Docker Compose failed to start the stack.
)
