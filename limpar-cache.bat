@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          LIMPAR CACHE E REINSTALAR                         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Isso vai remover node_modules e dist de ambos os projetos
echo e reinstalar todas as dependências do zero.
echo.
set /p confirmar="Continuar? (S/N): "
if /i not "%confirmar%"=="S" (
    echo Operação cancelada.
    pause
    exit /b 0
)

echo.
echo [1/4] Removendo backend\node_modules...
if exist backend\node_modules (
    rmdir /s /q backend\node_modules
    echo OK!
) else (
    echo Já estava limpo.
)

echo [2/4] Removendo backend\dist...
if exist backend\dist (
    rmdir /s /q backend\dist
    echo OK!
) else (
    echo Já estava limpo.
)

echo [3/4] Removendo frontend\node_modules...
if exist frontend\node_modules (
    rmdir /s /q frontend\node_modules
    echo OK!
) else (
    echo Já estava limpo.
)

echo [4/4] Removendo frontend\dist...
if exist frontend\dist (
    rmdir /s /q frontend\dist
    echo OK!
) else (
    echo Já estava limpo.
)

echo.
echo Reinstalando dependências...
echo.
call instalar.bat
