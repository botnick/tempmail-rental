@echo off
chcp 65001 >nul

REM ===========================================================
REM  TempMail — Start dev server
REM  Opens http://localhost:3000
REM
REM  If this is the first time you've run the project, run
REM  setup.bat first (one-time install + DB schema + seed).
REM ===========================================================

cd /d "%~dp0"

if not exist "node_modules" (
  echo.
  echo [!] node_modules missing — running setup first.
  echo.
  call setup.bat
  if errorlevel 1 exit /b 1
)

if not exist ".env" (
  echo [ERROR] .env not found. Copy .env.example to .env and fill in credentials.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   TempMail dev server starting...
echo   URL: http://localhost:3000
echo   Press Ctrl+C to stop
echo ============================================
echo.

call npm run dev
