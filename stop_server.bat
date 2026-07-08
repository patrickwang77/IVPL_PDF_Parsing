@echo off
title Stop PDF Extractor Server
echo Finding and stopping process on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a
    echo Server on PID %%a has been stopped.
)
timeout /t 2 >nul
