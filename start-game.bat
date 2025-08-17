@echo off
echo.
echo Tolkien RPG Game Launcher
echo ==========================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo OK: Node.js found
node --version

REM Check package.json
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo.
    echo Make sure you run this script from the game folder.
    echo.
    pause
    exit /b 1
)

echo OK: package.json found

REM Check node_modules
if not exist "node_modules" (
    echo.
    echo Installing dependencies...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies!
        echo.
        pause
        exit /b 1
    )
    echo OK: Dependencies installed
) else (
    echo OK: Dependencies already installed
)

REM Check game.json
if not exist "game.json" (
    echo.
    echo ERROR: game.json not found!
    echo.
    echo Setup configuration file:
    echo 1. Copy game.json.example to game.json
    echo 2. Add your Claude API key
    echo.
    pause
    exit /b 1
)

echo OK: game.json found

echo.
echo Building frontend...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Failed to build frontend!
    echo.
    pause
    exit /b 1
)
echo OK: Frontend built successfully

echo.
echo Starting unified game server...
echo.
echo Game: http://localhost:5000
echo Press Ctrl+C to stop server
echo.

REM Run server in foreground (will show logs and stop when console closes)
npm run dev

REM If server exits unexpectedly, pause to see error
if errorlevel 1 (
    echo.
    echo ERROR: Server stopped unexpectedly!
    echo.
    pause
)