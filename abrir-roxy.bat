@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js em nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  call node node_modules\electron\install.js
)
call npm start
pause
