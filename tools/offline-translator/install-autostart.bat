@echo off
rem Makes the offline translator start by itself, hidden, each time you sign in to Windows.
setlocal
set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"
if not exist "%DIR%\server.py" (
  echo server.py is not in this folder. Keep all the translator files together.
  pause
  exit /b 1
)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v GNSIOfflineTranslator /t REG_SZ /d "wscript.exe \"%DIR%\run-hidden.vbs\"" /f >nul
if errorlevel 1 (
  echo Could not set up automatic start.
  pause
  exit /b 1
)
wscript.exe "%DIR%\run-hidden.vbs"
echo.
echo Done. The offline translator now starts by itself when you sign in to Windows.
echo It has also been started now; give it a minute to load the model.
echo If it ever fails to start, open translator.log in this folder to see why.
echo To undo this, run remove-autostart.bat.
pause
