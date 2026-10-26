@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install a current Node.js LTS first. See README.md.
  pause
  exit /b 1
)
if not exist node_modules call npm ci
if errorlevel 1 (
  echo Dependency installation failed. Check your Internet connection.
  pause
  exit /b 1
)
call npm run dev
pause
