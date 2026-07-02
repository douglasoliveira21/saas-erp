@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     DIAGNÓSTICO DE CONEXÃO - PostgreSQL                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Este script vai testar a conexão com PostgreSQL usando
echo a mesma biblioteca que o NestJS usa (pg)
echo.
echo Pressione qualquer tecla para começar...
pause >nul
echo.

cd backend
node ../diagnostico-conexao.js

echo.
echo ═══════════════════════════════════════════════════════════
echo.
pause
