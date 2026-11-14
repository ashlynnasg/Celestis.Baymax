@echo off
setlocal
title Celestial Baymax - Local App
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_windows.ps1"
set "BAYMAX_EXIT=%ERRORLEVEL%"
popd
if not "%BAYMAX_EXIT%"=="0" pause
exit /b %BAYMAX_EXIT%
