@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          PARANDO O SISTEMA                                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo Encerrando processos Node.js nas portas 5000 e 5001...
echo.

REM Matar processo na porta 5000 (backend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 "') do (
    echo Encerrando processo PID %%a (porta 5000)...
    taskkill /PID %%a /F >nul 2>&1
)

REM Matar processo na porta 5001 (frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5001 "') do (
    echo Encerrando processo PID %%a (porta 5001)...
    taskkill /PID %%a /F >nul 2>&1
)

REM Matar todas as janelas cmd com título Backend ou Frontend
taskkill /FI "WINDOWTITLE eq Backend - NestJS" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend - Vite" /F >nul 2>&1

echo.
echo OK - Sistema encerrado!
echo.
pause
