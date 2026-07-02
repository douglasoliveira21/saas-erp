@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          VERIFICAR PORTAS DO SISTEMA                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo Verificando porta 5000 (Backend)...
netstat -ano | findstr ":5000 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OCUPADA] Porta 5000 está em uso:
    netstat -ano | findstr ":5000 "
) else (
    echo   [LIVRE] Porta 5000 está disponível.
)

echo.
echo Verificando porta 5001 (Frontend)...
netstat -ano | findstr ":5001 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OCUPADA] Porta 5001 está em uso:
    netstat -ano | findstr ":5001 "
) else (
    echo   [LIVRE] Porta 5001 está disponível.
)

echo.
echo Verificando porta 5432 (PostgreSQL)...
netstat -ano | findstr ":5432 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [ATIVO] PostgreSQL está rodando na porta 5432.
) else (
    echo   [INATIVO] PostgreSQL não detectado na porta 5432!
    echo   Verifique se o serviço PostgreSQL está iniciado.
)

echo.
echo ════════════════════════════════════════════════════════════
echo   Para liberar uma porta, use:
echo   taskkill /PID ^<numero_pid^> /F
echo ════════════════════════════════════════════════════════════
echo.
pause
