@echo off
setlocal
title Celestial Baymax - Setup
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_windows.ps1"
set "BAYMAX_EXIT=%ERRORLEVEL%"
popd
echo.
pause
exit /b %BAYMAX_EXIT%
