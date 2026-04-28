@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ===========================================================
REM  TempMail - First-time setup
REM  Install dependencies, generate Prisma client, push schema,
REM  and seed the database.
REM
REM  Run this once after cloning, after pulling schema changes,
REM  or any time the DB is fresh.
REM ===========================================================

cd /d "%~dp0"

echo.
echo ============================================
echo   TempMail - Setup
echo ============================================
echo.

REM 1) Node check
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo         Install Node 20+ from https://nodejs.org and re-run.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [1/5] Node detected: %NODE_VER%
echo.

REM 2) .env check
if not exist ".env" (
  echo [ERROR] .env not found.
  echo         Copy .env.example to .env and fill in DB / Redis credentials.
  pause
  exit /b 1
)
echo [2/5] .env found.
echo.

REM 3) Install dependencies
echo [3/5] Installing dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
echo.

REM 4) Generate Prisma client + push schema
echo [4/5] Pushing Prisma schema and generating client...
call npx prisma db push --accept-data-loss
if errorlevel 1 (
  echo [ERROR] prisma db push failed.
  echo         Check DATABASE_URL in .env can reach Postgres.
  pause
  exit /b 1
)
call npx prisma generate
echo.

REM 5) Seed
echo [5/5] Seeding database (roles, permissions, plans incl. guest tier, demo users)...
call npm run db:seed
if errorlevel 1 (
  echo [WARN] Seed failed or partial. Re-run dev_seed.bat to retry.
)

echo.
echo ============================================
echo   Setup complete.
echo   Next steps:
echo     - dev_start.bat       run dev server
echo     - dev_build.bat       production build
echo     - dev_seed.bat        re-run the seed
echo ============================================
echo.
pause
