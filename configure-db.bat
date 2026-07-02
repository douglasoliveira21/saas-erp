@echo off
echo 🔧 Configurador de Banco de Dados
echo.
echo Este script vai ajudar você a configurar a conexão com o PostgreSQL
echo.

:menu
echo ========================================
echo Escolha uma opção:
echo ========================================
echo.
echo 1. Usar PostgreSQL local (localhost)
echo 2. Usar PostgreSQL remoto (192.168.25.100)
echo 3. Configurar senha personalizada
echo 4. Testar conexão
echo 5. Sair
echo.
set /p opcao="Digite o número da opção: "

if "%opcao%"=="1" goto local
if "%opcao%"=="2" goto remoto
if "%opcao%"=="3" goto senha
if "%opcao%"=="4" goto testar
if "%opcao%"=="5" goto fim
goto menu

:local
echo.
echo 📝 Configurando para PostgreSQL LOCAL...
echo.
set /p senha="Digite a senha do usuário postgres (padrão: postgres): "
if "%senha%"=="" set senha=postgres

echo DATABASE_HOST=localhost> backend\.env
echo DATABASE_PORT=5432>> backend\.env
echo DATABASE_USER=postgres>> backend\.env
echo DATABASE_PASSWORD=%senha%>> backend\.env
echo DATABASE_NAME=gestao_ti>> backend\.env
echo.>> backend\.env
echo JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e>> backend\.env
echo JWT_EXPIRES_IN=7d>> backend\.env
echo.>> backend\.env
echo PORT=5000>> backend\.env
echo NODE_ENV=development>> backend\.env
echo.>> backend\.env
echo CORS_ORIGIN=http://localhost:5001>> backend\.env

echo.
echo ✅ Configuração salva em backend\.env
echo.
goto testar

:remoto
echo.
echo 📝 Configurando para PostgreSQL REMOTO (192.168.25.100)...
echo.
set /p senha="Digite a senha do usuário postgres: "

echo DATABASE_HOST=192.168.25.100> backend\.env
echo DATABASE_PORT=5432>> backend\.env
echo DATABASE_USER=postgres>> backend\.env
echo DATABASE_PASSWORD=%senha%>> backend\.env
echo DATABASE_NAME=gestao_ti>> backend\.env
echo.>> backend\.env
echo JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e>> backend\.env
echo JWT_EXPIRES_IN=7d>> backend\.env
echo.>> backend\.env
echo PORT=5000>> backend\.env
echo NODE_ENV=development>> backend\.env
echo.>> backend\.env
echo CORS_ORIGIN=http://localhost:5001>> backend\.env

echo.
echo ✅ Configuração salva em backend\.env
echo.
goto testar

:senha
echo.
echo 📝 Configuração Personalizada...
echo.
set /p host="Host do PostgreSQL (ex: localhost): "
set /p porta="Porta (padrão: 5432): "
if "%porta%"=="" set porta=5432
set /p usuario="Usuário (padrão: postgres): "
if "%usuario%"=="" set usuario=postgres
set /p senha="Senha: "

echo DATABASE_HOST=%host%> backend\.env
echo DATABASE_PORT=%porta%>> backend\.env
echo DATABASE_USER=%usuario%>> backend\.env
echo DATABASE_PASSWORD=%senha%>> backend\.env
echo DATABASE_NAME=gestao_ti>> backend\.env
echo.>> backend\.env
echo JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e>> backend\.env
echo JWT_EXPIRES_IN=7d>> backend\.env
echo.>> backend\.env
echo PORT=5000>> backend\.env
echo NODE_ENV=development>> backend\.env
echo.>> backend\.env
echo CORS_ORIGIN=http://localhost:5001>> backend\.env

echo.
echo ✅ Configuração salva em backend\.env
echo.
goto testar

:testar
echo.
echo 🔍 Testando conexão com o banco de dados...
echo.

REM Ler configurações do .env
for /f "tokens=1,2 delims==" %%a in (backend\.env) do (
    if "%%a"=="DATABASE_HOST" set DB_HOST=%%b
    if "%%a"=="DATABASE_PORT" set DB_PORT=%%b
    if "%%a"=="DATABASE_USER" set DB_USER=%%b
    if "%%a"=="DATABASE_PASSWORD" set DB_PASS=%%b
)

echo Host: %DB_HOST%
echo Porta: %DB_PORT%
echo Usuário: %DB_USER%
echo.

REM Testar conexão
set PGPASSWORD=%DB_PASS%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "SELECT version();" 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Conexão bem-sucedida!
    echo.
    set /p criar="Deseja criar o banco de dados agora? (S/N): "
    if /i "%criar%"=="S" (
        echo.
        echo 📊 Criando banco de dados...
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -f setup-database.sql
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo ✅ Banco criado com sucesso!
            echo.
            echo 📊 Executando seeds...
            cd backend
            call npm run seed
            cd ..
            echo.
            echo 🎉 Setup completo!
            echo.
            echo Próximo passo: Execute start.bat
        )
    )
) else (
    echo.
    echo ❌ Falha na conexão!
    echo.
    echo Verifique:
    echo 1. PostgreSQL está rodando
    echo 2. Host e porta estão corretos
    echo 3. Usuário e senha estão corretos
    echo 4. Firewall não está bloqueando
    echo.
)

echo.
pause
goto menu

:fim
echo.
echo 👋 Até logo!
echo.
exit /b 0
