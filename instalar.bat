@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          INSTALAÇÃO DE DEPENDÊNCIAS                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo [1/2] Instalando dependências do Backend...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO: Falha ao instalar dependências do backend!
    pause
    exit /b 1
)
echo OK - Backend instalado!
cd ..

echo.
echo [2/2] Instalando dependências do Frontend...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO: Falha ao instalar dependências do frontend!
    pause
    exit /b 1
)
echo OK - Frontend instalado!
cd ..

echo.
echo ════════════════════════════════════════════════════════════
echo   Instalação concluída com sucesso!
echo   Próximo passo: execute setup-db.bat
echo ════════════════════════════════════════════════════════════
echo.
pause
