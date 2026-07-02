@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          RESETAR BANCO DE DADOS                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo ATENÇÃO: Esta operação vai APAGAR todos os dados do banco!
echo.
set /p confirmar="Tem certeza? Digite SIM para continuar: "
if /i not "%confirmar%"=="SIM" (
    echo.
    echo Operação cancelada.
    pause
    exit /b 0
)

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
)

set PGPASSWORD=%DB_PASS%

echo.
echo [1/4] Removendo banco "%DB_NAME%"...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;"
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha ao remover banco!
    pause
    exit /b 1
)
echo OK - Banco removido!

echo.
echo [2/4] Criando banco "%DB_NAME%"...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;"
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha ao criar banco!
    pause
    exit /b 1
)
echo OK - Banco criado!

echo.
echo [3/4] Aplicando schema...
if exist backend\database\schema.sql (
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f backend\database\schema.sql
    if %ERRORLEVEL% NEQ 0 (
        echo ERRO: Falha ao aplicar schema!
        pause
        exit /b 1
    )
    echo OK - Schema aplicado!
) else (
    echo AVISO: schema.sql não encontrado. Pulando...
)

echo.
echo [4/4] Executando seeds...
cd backend
call npm run seed
if %ERRORLEVEL% NEQ 0 (
    echo AVISO: Falha ao executar seeds.
) else (
    echo OK - Seeds executados!
)
cd ..

echo.
echo ════════════════════════════════════════════════════════════
echo   Banco resetado com sucesso!
echo   Execute start.bat para iniciar o sistema.
echo ════════════════════════════════════════════════════════════
echo.
pause
