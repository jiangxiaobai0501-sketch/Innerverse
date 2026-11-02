@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "TEMP=%~dp0work\tmp"
set "TMP=%TEMP%"
set "npm_config_cache=%~dp0work\npm-cache"
set "NODE_COMPILE_CACHE=%~dp0work\node-cache"
set "ELECTRON_CACHE=%~dp0work\electron-cache"
set "ELECTRON_BUILDER_CACHE=%~dp0work\electron-builder-cache"
set "ELECTRON_RUN_AS_NODE="
if not exist "%TEMP%" mkdir "%TEMP%"
call npm run build
if errorlevel 1 exit /b 1
"%~dp0node_modules\electron\dist\electron.exe" "%~dp0." "--user-data-dir=%~dp0work\preview-profile"
