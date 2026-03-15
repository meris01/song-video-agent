@echo off
echo Stopping Song Video Agent...
taskkill /F /FI "WINDOWTITLE eq Song Video Agent*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq npm*" >nul 2>&1
echo Done.
pause
