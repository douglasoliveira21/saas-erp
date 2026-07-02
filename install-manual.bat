@echo off
REM Script para instalação manual das dependências

echo 📦 Instalação Manual das Dependências
echo.
echo Este script instala as dependências de cada pasta separadamente
echo para evitar problemas com caminhos UNC.
echo.

REM Instalar dependências da raiz
echo [1/3] Instalando dependências da raiz...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao instalar dependências da raiz
    pause
    exit /b 1
)
echo ✅ Dependências da raiz instaladas!
echo.

REM Instalar dependências do backend
echo [2/3] Instalando dependências do backend...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao instalar dependências do backend
    cd ..
    pause
    exit /b 1
)
echo ✅ Dependências do backend instaladas!
cd ..
echo.

REM Instalar dependências do frontend
echo [3/3] Instalando dependências do frontend...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao instalar dependências do frontend
    cd ..
    pause
    exit /b 1
)
echo ✅ Dependências do frontend instaladas!
cd ..
echo.

echo 🎉 Todas as dependências foram instaladas com sucesso!
echo.
echo Próximos passos:
echo 1. Execute: setup-db.bat (para criar o banco de dados)
echo 2. Execute: start.bat (para iniciar o sistema)
echo.

pause
