@echo off
rem Stops the offline translator and stops it starting by itself.
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v GNSIOfflineTranslator /f >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8765 .*LISTENING"') do taskkill /PID %%p /F >nul 2>&1
echo Done. The offline translator is stopped and will no longer start by itself.
pause
