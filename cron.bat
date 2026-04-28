@echo off
chcp 65001 >nul
setlocal

REM ===========================================================
REM  TempMail — Manual cron trigger (for local testing)
REM
REM  Hits /api/cron/expire and /api/cron with the configured
REM  CRON_SECRET. Make sure dev server is running (start.bat).
REM
REM  Usage:
REM    cron.bat            run both
REM    cron.bat expire     run expire-mailboxes only
REM    cron.bat all        run general cleanup only
REM ===========================================================

cd /d "%~dp0"

REM Pull CRON_SECRET out of .env (line starts with CRON_SECRET=)
set "CRON_SECRET="
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
  if /i "%%a"=="CRON_SECRET" (
    set "CRON_SECRET=%%~b"
  )
)

REM Strip surrounding quotes if any
set CRON_SECRET=%CRON_SECRET:"=%

if "%CRON_SECRET%"=="" (
  echo [ERROR] CRON_SECRET not found in .env
  pause
  exit /b 1
)

set BASE=http://localhost:3000

set MODE=%1
if "%MODE%"=="" set MODE=both

if /i "%MODE%"=="expire" goto :expire
if /i "%MODE%"=="all" goto :general
if /i "%MODE%"=="both" goto :both

echo Unknown mode: %MODE%
echo Usage: cron.bat [expire^|all^|both]
exit /b 1

:expire
echo.
echo === POST /api/cron/expire ===
curl -s -X POST -H "Authorization: Bearer %CRON_SECRET%" "%BASE%/api/cron/expire"
echo.
goto :done

:general
echo.
echo === GET /api/cron ===
curl -s -H "Authorization: Bearer %CRON_SECRET%" "%BASE%/api/cron"
echo.
goto :done

:both
echo.
echo === POST /api/cron/expire ===
curl -s -X POST -H "Authorization: Bearer %CRON_SECRET%" "%BASE%/api/cron/expire"
echo.
echo === GET /api/cron ===
curl -s -H "Authorization: Bearer %CRON_SECRET%" "%BASE%/api/cron"
echo.

:done
echo.
pause
