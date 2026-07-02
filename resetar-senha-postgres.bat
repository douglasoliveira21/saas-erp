@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     RESETAR SENHA DO POSTGRESQL (Admin necessário)         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo IMPORTANTE: Execute este arquivo como Administrador!
echo.

REM Verificar se está rodando como admin
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Este script precisa ser executado como Administrador!
    echo.
    echo Clique com botão direito no arquivo e selecione
    echo "Executar como administrador".
    echo.
    pause
    exit /b 1
)

echo Procurando instalação do PostgreSQL...
echo.

REM Tentar encontrar pg_hba.conf em locais comuns
set PG_HBA=
set PG_DATA=

for %%v in (17 16 15 14 13 12) do (
    if exist "C:\Program Files\PostgreSQL\%%v\data\pg_hba.conf" (
        set PG_HBA=C:\Program Files\PostgreSQL\%%v\data\pg_hba.conf
        set PG_DATA=C:\Program Files\PostgreSQL\%%v\data
        set PG_VERSION=%%v
    )
)

if "%PG_HBA%"=="" (
    echo ERRO: PostgreSQL não encontrado nos caminhos padrão!
    echo.
    echo Informe o caminho manualmente:
    set /p PG_DATA="Caminho do data dir (ex: C:\Program Files\PostgreSQL\14\data): "
    set PG_HBA=%PG_DATA%\pg_hba.conf
)

echo PostgreSQL encontrado: versão %PG_VERSION%
echo Arquivo: %PG_HBA%
echo.

REM Fazer backup do pg_hba.conf
copy "%PG_HBA%" "%PG_HBA%.bak" >nul
echo OK - Backup criado: %PG_HBA%.bak

echo.
echo Configurando autenticação temporária (trust)...
echo # Configuracao temporaria para reset de senha > "%PG_HBA%"
echo local   all             all                                     trust >> "%PG_HBA%"
echo host    all             all             127.0.0.1/32            trust >> "%PG_HBA%"
echo host    all             all             ::1/128                 trust >> "%PG_HBA%"

echo.
echo Reiniciando PostgreSQL...
net stop postgresql-x64-%PG_VERSION% >nul 2>&1
net stop postgresql-%PG_VERSION% >nul 2>&1
timeout /t 2 /nobreak >nul
net start postgresql-x64-%PG_VERSION% >nul 2>&1
net start postgresql-%PG_VERSION% >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
set /p nova_senha="Digite a nova senha para o usuário postgres (padrão: postgres): "
if "%nova_senha%"=="" set nova_senha=postgres

echo.
echo Definindo nova senha...
psql -U postgres -c "ALTER USER postgres WITH PASSWORD '%nova_senha%';"

if %ERRORLEVEL% EQU 0 (
    echo OK - Senha definida com sucesso!
) else (
    echo ERRO: Falha ao definir senha. Restaurando configuração original...
    copy "%PG_HBA%.bak" "%PG_HBA%" >nul
    net stop postgresql-x64-%PG_VERSION% >nul 2>&1
    net start postgresql-x64-%PG_VERSION% >nul 2>&1
    pause
    exit /b 1
)

echo.
echo Restaurando configuração segura do pg_hba.conf...
echo # PostgreSQL Client Authentication Configuration >> nul
echo local   all             all                                     scram-sha-256 > "%PG_HBA%"
echo host    all             all             127.0.0.1/32            scram-sha-256 >> "%PG_HBA%"
echo host    all             all             ::1/128                 scram-sha-256 >> "%PG_HBA%"

echo.
echo Reiniciando PostgreSQL com configuração segura...
net stop postgresql-x64-%PG_VERSION% >nul 2>&1
net stop postgresql-%PG_VERSION% >nul 2>&1
timeout /t 2 /nobreak >nul
net start postgresql-x64-%PG_VERSION% >nul 2>&1
net start postgresql-%PG_VERSION% >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo Atualizando backend\.env com a nova senha...
if exist backend\.env (
    REM Reescrever o .env com a nova senha
    set PGPASSWORD=%nova_senha%
    echo DATABASE_HOST=localhost> backend\.env
    echo DATABASE_PORT=5432>> backend\.env
    echo DATABASE_USER=postgres>> backend\.env
    echo DATABASE_PASSWORD=%nova_senha%>> backend\.env
    echo DATABASE_NAME=gestao_ti>> backend\.env
    echo.>> backend\.env
    echo JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e>> backend\.env
    echo JWT_EXPIRES_IN=7d>> backend\.env
    echo.>> backend\.env
    echo PORT=5000>> backend\.env
    echo NODE_ENV=development>> backend\.env
    echo.>> backend\.env
    echo CORS_ORIGIN=http://localhost:5001>> backend\.env
    echo OK - backend\.env atualizado!
)

echo.
echo Testando conexão...
set PGPASSWORD=%nova_senha%
psql -U postgres -c "SELECT version();" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo OK - Conexão funcionando!
) else (
    echo AVISO: Teste de conexão falhou. Verifique manualmente.
)

echo.
echo ════════════════════════════════════════════════════════════
echo   Senha do PostgreSQL redefinida com sucesso!
echo   Próximos passos:
echo     1. setup-db.bat   (criar banco e tabelas)
echo     2. start.bat      (iniciar o sistema)
echo ════════════════════════════════════════════════════════════
echo.
pause
