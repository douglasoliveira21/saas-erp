@echo off
echo.
echo ========================================
echo   CORRIGIR SENHA DO POSTGRESQL
echo ========================================
echo.
echo A senha atual no .env está INCORRETA!
echo.
echo Vamos testar algumas senhas comuns...
echo.

REM Testar senhas comuns
set senhas=postgres admin root password 12345

for %%s in (%senhas%) do (
    echo Testando senha: %%s
    set PGPASSWORD=%%s
    psql -U postgres -c "SELECT 1" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo.
        echo ✅ SENHA ENCONTRADA: %%s
        echo.
        echo Salvando no arquivo .env...
        
        echo DATABASE_HOST=localhost> backend\.env
        echo DATABASE_PORT=5432>> backend\.env
        echo DATABASE_USER=postgres>> backend\.env
        echo DATABASE_PASSWORD=%%s>> backend\.env
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
        echo ✅ Arquivo .env atualizado!
        echo.
        echo Agora execute: start.bat
        echo.
        pause
        exit /b 0
    )
)

echo.
echo ❌ Nenhuma senha comum funcionou!
echo.
echo Por favor, digite a senha manualmente:
echo.
set /p senha_manual="Senha do PostgreSQL: "

echo.
echo Testando senha digitada...
set PGPASSWORD=%senha_manual%
psql -U postgres -c "SELECT 1" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SENHA CORRETA!
    echo.
    echo Salvando no arquivo .env...
    
    echo DATABASE_HOST=localhost> backend\.env
    echo DATABASE_PORT=5432>> backend\.env
    echo DATABASE_USER=postgres>> backend\.env
    echo DATABASE_PASSWORD=%senha_manual%>> backend\.env
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
    echo ✅ Arquivo .env atualizado!
    echo.
    echo Agora execute: start.bat
) else (
    echo.
    echo ❌ Senha incorreta!
    echo.
    echo Verifique a senha do PostgreSQL e tente novamente.
)

echo.
pause
