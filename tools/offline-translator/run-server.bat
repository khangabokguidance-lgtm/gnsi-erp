@echo off
rem Runs server.py with a Python that works with PyTorch. Used by start-translator.bat
rem and run-hidden.vbs. Newer Python versions (3.14) often have no PyTorch build, and
rem plain "python" on Windows can be the Microsoft Store shortcut, which does nothing,
rem so the "py" launcher is tried first, preferring 3.12.
cd /d "%~dp0"
for %%v in (3.12 3.11 3.13 3.10) do (
  py -%%v -c "import sys" >nul 2>&1
  if not errorlevel 1 (
    py -%%v server.py %*
    exit /b
  )
)
python server.py %*
