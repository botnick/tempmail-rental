@echo off
chcp 65001 >nul

REM ===========================================================
REM  TempMail — Production build + start
REM
REM  Compiles Next.js for production (Turbopack) and then starts
REM  the production server. Use for staging or local prod test.
REM ===========================================================

cd /d "%~dp0"

if not exist "node_modules" (
  echo [!] node_modules missing — run setup.bat first.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Building production bundle...
echo ============================================
echo.

call npx prisma generate
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Build OK — starting production server.
echo   URL: http://localhost:3000
echo   Press Ctrl+C to stop
echo ============================================
echo.

call npm run start
