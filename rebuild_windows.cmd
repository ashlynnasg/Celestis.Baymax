@echo off
setlocal
title Celestial Baymax - Rebuild Source
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\rebuild_windows.ps1"
set "BAYMAX_EXIT=%ERRORLEVEL%"
popd
pause
exit /b %BAYMAX_EXIT%
