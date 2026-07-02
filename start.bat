@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          INICIANDO SISTEMA DE GESTÃO DE TI                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Verificar se node_modules existem
if not exist backend\node_modules (
    echo AVISO: Dependências do backend não instaladas.
    echo Execute instalar.bat primeiro!
    echo.
    pause
    exit /b 1
)

if not exist frontend\node_modules (
    echo AVISO: Dependências do frontend não instaladas.
    echo Execute instalar.bat primeiro!
    echo.
    pause
    exit /b 1
)

echo Iniciando Backend (porta 5000)...
start "Backend - NestJS" cmd /k "cd backend && npm run start:dev"

echo Aguardando backend inicializar...
timeout /t 5 /nobreak >nul

echo Iniciando Frontend (porta 5001)...
start "Frontend - Vite" cmd /k "cd frontend && npm run dev"

echo.
echo ════════════════════════════════════════════════════════════
echo   Sistema iniciado em duas janelas separadas!
echo.
echo   Backend:  http://localhost:5000/api
echo   Frontend: http://localhost:5001
echo.
echo   Login Admin:
echo     Email: admin@gestao.com
echo     Senha: admin123
echo ════════════════════════════════════════════════════════════
echo.
echo Abrindo o sistema no navegador em 5 segundos...
timeout /t 5 /nobreak >nul
start http://localhost:5001

echo.
echo Para parar o sistema, feche as janelas do Backend e Frontend.
pause
