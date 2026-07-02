@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          CONFIGURAR BANCO DE DADOS                         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Ler configurações do .env
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=postgres
set DB_PASS=postgres
set DB_NAME=gestao_ti

if exist backend\.env (
    for /f "usebackq tokens=1,2 delims==" %%a in ("backend\.env") do (
        if "%%a"=="DATABASE_HOST" set DB_HOST=%%b
        if "%%a"=="DATABASE_PORT" set DB_PORT=%%b
        if "%%a"=="DATABASE_USER" set DB_USER=%%b
        if "%%a"=="DATABASE_PASSWORD" set DB_PASS=%%b
        if "%%a"=="DATABASE_NAME" set DB_NAME=%%b
    )
) else (
    echo AVISO: backend\.env não encontrado. Usando valores padrão.
    echo Execute configure-db.bat primeiro para configurar a conexão.
    echo.
)

echo Configurações detectadas:
echo   Host:  %DB_HOST%
echo   Porta: %DB_PORT%
echo   User:  %DB_USER%
echo   Banco: %DB_NAME%
echo.

set PGPASSWORD=%DB_PASS%

echo [1/3] Criando banco de dados "%DB_NAME%"...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo OK - Banco criado!
) else (
    echo AVISO - Banco já existe ou erro ao criar. Continuando...
)

echo.
echo [2/3] Executando schema SQL...
if exist backend\database\schema.sql (
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f backend\database\schema.sql
    if %ERRORLEVEL% NEQ 0 (
        echo ERRO: Falha ao executar schema!
        pause
        exit /b 1
    )
    echo OK - Schema aplicado!
) else (
    echo AVISO: backend\database\schema.sql não encontrado. Pulando...
)

echo.
echo [3/3] Executando seeds (dados iniciais)...
cd backend
call npm run seed
if %ERRORLEVEL% NEQ 0 (
    echo AVISO: Falha ao executar seeds. Verifique o banco manualmente.
) else (
    echo OK - Seeds executados!
)
cd ..

echo.
echo ════════════════════════════════════════════════════════════
echo   Banco de dados configurado!
echo   Próximo passo: execute start.bat
echo ════════════════════════════════════════════════════════════
echo.
pause
