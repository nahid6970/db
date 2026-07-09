@echo off
title Image-Share Sync
chcp 65001 > nul
"C:\Users\nahid\scoop\apps\python312\current\python.exe" "%~dp0sync.py"
echo.
echo Press any key to close...
pause > nul
