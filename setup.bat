@echo off
echo ============================================
echo   Song Video Agent - Setup
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed!
    echo Download from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)
echo [OK] Python found

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Check FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] FFmpeg not found. Video rendering won't work.
    echo Download from: https://www.gyan.dev/ffmpeg/builds/
    echo Extract and add to PATH.
) else (
    echo [OK] FFmpeg found
)

echo.
echo --- Installing Python dependencies ---
pip install -r webapp\backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Python dependency install failed!
    pause
    exit /b 1
)
echo [OK] Python dependencies installed

echo.
echo --- Installing Frontend dependencies ---
cd webapp\frontend
call npm install
if errorlevel 1 (
    echo [ERROR] Frontend dependency install failed!
    pause
    exit /b 1
)
cd ..\..
echo [OK] Frontend dependencies installed

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Next steps:
echo   1. Run: start.bat
echo   2. Open: http://localhost:3000
echo   3. Go to Settings and add your API keys
echo.
pause
