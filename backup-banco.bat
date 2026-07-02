@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          BACKUP DO BANCO DE DADOS                          ║
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
)

REM Criar pasta de backups se não existir
if not exist backups mkdir backups

REM Nome do arquivo com data e hora
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DATA=%%c%%b%%a
for /f "tokens=1-2 delims=: " %%a in ("%time%") do set HORA=%%a%%b
set HORA=%HORA: =0%
set ARQUIVO=backups\backup_%DB_NAME%_%DATA%_%HORA%.sql

echo Fazendo backup de "%DB_NAME%"...
echo Arquivo: %ARQUIVO%
echo.

set PGPASSWORD=%DB_PASS%
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME% > %ARQUIVO%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo OK - Backup salvo em: %ARQUIVO%
) else (
    echo.
    echo ERRO: Falha ao fazer backup!
    echo Verifique se pg_dump está no PATH do sistema.
)

echo.
pause
