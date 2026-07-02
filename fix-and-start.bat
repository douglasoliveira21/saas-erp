@echo off
echo 🔧 Corrigindo dependências e iniciando sistema...
echo.

echo 📦 Instalando dependência dotenv no backend...
cd backend
call npm install dotenv
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao instalar dotenv
    pause
    exit /b 1
)
echo ✅ Dotenv instalado!
cd ..
echo.

echo 🚀 Iniciando sistema...
echo.
echo 🔧 Backend: http://localhost:5000/api
echo 🎨 Frontend: http://localhost:5001
echo.
echo 👤 Login: admin@empresa.com / Admin@123
echo.

call npm run dev
