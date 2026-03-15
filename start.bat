@echo off
echo ============================================
echo   Song Video Agent - Starting...
echo ============================================
echo.

:: Start Backend
echo Starting backend server...
start "Song Video Agent - Backend" cmd /k "cd /d %~dp0webapp\backend && python -c \"import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000)\""

:: Wait for backend
timeout /t 3 /nobreak >nul

:: Start Frontend
echo Starting frontend...
start "Song Video Agent - Frontend" cmd /k "cd /d %~dp0webapp\frontend && npm run dev"

:: Wait for frontend
timeout /t 4 /nobreak >nul

echo.
echo ============================================
echo   Song Video Agent is running!
echo ============================================
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo.
echo   Close both terminal windows to stop.
echo.

:: Open browser
start http://localhost:3000
