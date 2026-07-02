@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          STATUS DO SISTEMA                                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Verificar Node.js
echo [Node.js]
node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f %%v in ('node --version') do echo   Versão: %%v
) else (
    echo   ERRO: Node.js não encontrado!
)

echo.
REM Verificar npm
echo [npm]
npm --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f %%v in ('npm --version') do echo   Versão: %%v
) else (
    echo   ERRO: npm não encontrado!
)

echo.
REM Verificar PostgreSQL
echo [PostgreSQL]
psql --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('psql --version') do echo   %%v
) else (
    echo   AVISO: psql não encontrado no PATH.
)

REM Verificar serviço PostgreSQL
sc query postgresql-x64-17 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    sc query postgresql-x64-17 | findstr "RUNNING" >nul
    if %ERRORLEVEL% EQU 0 (echo   Serviço: RODANDO) else (echo   Serviço: PARADO)
) else (
    for %%v in (16 15 14 13 12) do (
        sc query postgresql-x64-%%v >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            sc query postgresql-x64-%%v | findstr "RUNNING" >nul
            if %ERRORLEVEL% EQU 0 (echo   Serviço: RODANDO) else (echo   Serviço: PARADO)
        )
    )
)

echo.
REM Verificar dependências instaladas
echo [Dependências]
if exist backend\node_modules (
    echo   Backend:  INSTALADO
) else (
    echo   Backend:  NAO INSTALADO - execute instalar.bat
)
if exist frontend\node_modules (
    echo   Frontend: INSTALADO
) else (
    echo   Frontend: NAO INSTALADO - execute instalar.bat
)

echo.
REM Verificar .env
echo [Configuração]
if exist backend\.env (
    echo   backend\.env:  OK
) else (
    echo   backend\.env:  NAO ENCONTRADO - execute configure-db.bat
)
if exist frontend\.env (
    echo   frontend\.env: OK
) else (
    echo   frontend\.env: NAO ENCONTRADO
)

echo.
REM Verificar portas
echo [Portas]
netstat -ano | findstr ":5000 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo   5000 (Backend):     OCUPADA) else (echo   5000 (Backend):     livre)

netstat -ano | findstr ":5001 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo   5001 (Frontend):    OCUPADA) else (echo   5001 (Frontend):    livre)

netstat -ano | findstr ":5432 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo   5432 (PostgreSQL):  ATIVO) else (echo   5432 (PostgreSQL):  inativo)

echo.
echo ════════════════════════════════════════════════════════════
pause
