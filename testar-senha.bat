@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     TESTAR SENHA DO POSTGRESQL - SOLUÇÃO RÁPIDA           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 🔍 Vamos descobrir a senha correta do PostgreSQL...
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Verificar se psql está disponível
where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERRO: PostgreSQL não encontrado no PATH!
    echo.
    echo 💡 Adicione o PostgreSQL ao PATH:
    echo    C:\Program Files\PostgreSQL\14\bin
    echo.
    pause
    exit /b 1
)

echo ✅ PostgreSQL encontrado!
echo.
echo Testando senhas comuns...
echo.

REM Testar senha: postgres
echo [1/5] Testando senha: postgres
set PGPASSWORD=postgres
psql -U postgres -d postgres -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    goto :senha_encontrada_postgres
)

REM Testar senha vazia
echo [2/5] Testando senha: (vazia)
set PGPASSWORD=
psql -U postgres -d postgres -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    goto :senha_encontrada_vazia
)

REM Testar senha: admin
echo [3/5] Testando senha: admin
set PGPASSWORD=admin
psql -U postgres -d postgres -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    goto :senha_encontrada_admin
)

REM Testar senha: root
echo [4/5] Testando senha: root
set PGPASSWORD=root
psql -U postgres -d postgres -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    goto :senha_encontrada_root
)

REM Testar senha: password
echo [5/5] Testando senha: password
set PGPASSWORD=password
psql -U postgres -d postgres -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    goto :senha_encontrada_password
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ❌ Nenhuma senha comum funcionou!
echo.
echo 💡 Vamos tentar manualmente...
echo.
set /p senha_manual="Digite a senha do PostgreSQL: "

echo.
echo Testando senha digitada...
set PGPASSWORD=%senha_manual%
psql -U postgres -d postgres -c "SELECT 1" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SENHA CORRETA!
    goto :atualizar_env
) else (
    echo.
    echo ❌ Senha incorreta!
    echo.
    echo 🆘 OPÇÕES:
    echo.
    echo 1. Tente novamente executando este script
    echo 2. Verifique a senha na instalação do PostgreSQL
    echo 3. Leia o arquivo: CORRIGIR-SENHA.md
    echo.
    pause
    exit /b 1
)

:senha_encontrada_postgres
set senha_correta=postgres
goto :senha_encontrada

:senha_encontrada_vazia
set senha_correta=
goto :senha_encontrada

:senha_encontrada_admin
set senha_correta=admin
goto :senha_encontrada

:senha_encontrada_root
set senha_correta=root
goto :senha_encontrada

:senha_encontrada_password
set senha_correta=password
goto :senha_encontrada

:senha_encontrada
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✅ SENHA ENCONTRADA: %senha_correta%
echo.
set senha_manual=%senha_correta%
goto :atualizar_env

:atualizar_env
echo Atualizando arquivo backend\.env...
echo.

(
echo DATABASE_HOST=localhost
echo DATABASE_PORT=5432
echo DATABASE_USER=postgres
echo DATABASE_PASSWORD=%senha_manual%
echo DATABASE_NAME=gestao_ti
echo.
echo JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e
echo JWT_EXPIRES_IN=7d
echo.
echo PORT=5000
echo NODE_ENV=development
echo.
echo CORS_ORIGIN=http://localhost:5001
) > backend\.env

echo ✅ Arquivo backend\.env atualizado!
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🎯 PRÓXIMOS PASSOS:
echo.
echo 1. Execute: setup-db.bat
echo    (Cria o banco de dados e tabelas)
echo.
echo 2. Execute: start.bat
echo    (Inicia o sistema)
echo.
echo 3. Acesse: http://localhost:5001
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause
