@echo off
setlocal
title EliteAchievements
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this PC.
  echo   Install it from https://nodejs.org then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   =====================================================
echo    ELITE ACHIEVEMENTS
echo    Starting the local server...
echo    A browser tab will open at http://localhost:8787
echo    once it's ready (first launch scans your journals).
echo.
echo    Keep this window open while you play.
echo    Close it (or press Ctrl+C) to stop.
echo   =====================================================
echo.

rem Wait in the background until the server is listening, then open the browser.
start "" powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){ try{ $null = Invoke-WebRequest -UseBasicParsing http://localhost:8787 -TimeoutSec 1; Start-Process 'http://localhost:8787'; break } catch { Start-Sleep -Seconds 1 } }"

call npm start
