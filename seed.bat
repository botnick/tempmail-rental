@echo off
chcp 65001 >nul

REM ===========================================================
REM  TempMail — Re-seed database
REM
REM  Re-runs the seed script. Idempotent (uses upsert) so safe
REM  to run multiple times. Use after pulling new seed data
REM  (e.g. new plans / permissions added).
REM ===========================================================

cd /d "%~dp0"

if not exist ".env" (
  echo [ERROR] .env not found.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Seeding database...
echo ============================================
echo.

call npx prisma generate
call npm run db:seed
if errorlevel 1 (
  echo.
  echo [ERROR] Seed failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Seed complete.
echo ============================================
echo.
pause
