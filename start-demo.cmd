@echo off
cd /d "%~dp0"
if not exist preview.html (
  echo Run npm ci and npm run build first, or download the ready-to-run demo.
  pause
  exit /b 1
)
start "" "%~dp0preview.html"
