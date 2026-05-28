@echo off
setlocal

cd /d "%~dp0"
set "PORT=5173"
set "URL=http://127.0.0.1:%PORT%/"

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "%URL%"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "%URL%"
  py -m http.server %PORT% --bind 127.0.0.1
  goto :done
)

echo Python was not found. Install Python or run this from a terminal with Python available.
pause

:done
endlocal
