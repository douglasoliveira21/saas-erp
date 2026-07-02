@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          BUILD PARA PRODUÇÃO                               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo [1/2] Build do Backend...
cd backend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO: Falha no build do backend!
    pause
    exit /b 1
)
echo OK - Backend compilado em backend\dist\
cd ..

echo.
echo [2/2] Build do Frontend...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO: Falha no build do frontend!
    pause
    exit /b 1
)
echo OK - Frontend compilado em frontend\dist\
cd ..

echo.
echo ════════════════════════════════════════════════════════════
echo   Build concluído com sucesso!
echo.
echo   Backend:  backend\dist\
echo   Frontend: frontend\dist\
echo ════════════════════════════════════════════════════════════
echo.
pause
