@echo off
chcp 65001 >nul

:menu
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          SISTEMA DE GESTÃO DE TI - MENU PRINCIPAL         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo   CONFIGURAÇÃO INICIAL
echo   ─────────────────────────────────────────────────────────
echo   [1] Instalar dependências          (instalar.bat)
echo   [2] Configurar banco de dados      (configure-db.bat)
echo   [3] Criar tabelas e dados iniciais (setup-db.bat)
echo   [4] Resetar senha do PostgreSQL    (resetar-senha-postgres.bat)
echo.
echo   OPERAÇÃO
echo   ─────────────────────────────────────────────────────────
echo   [5] Iniciar sistema                (start.bat)
echo   [6] Parar sistema                  (parar.bat)
echo   [7] Status do sistema              (status.bat)
echo   [8] Verificar portas               (verificar-portas.bat)
echo.
echo   MANUTENÇÃO
echo   ─────────────────────────────────────────────────────────
echo   [9] Backup do banco de dados       (backup-banco.bat)
echo   [R] Resetar banco de dados         (resetar-banco.bat)
echo   [L] Limpar cache e reinstalar      (limpar-cache.bat)
echo   [B] Build para produção            (build.bat)
echo   [D] Diagnóstico de conexão         (diagnostico.bat)
echo.
echo   [0] Sair
echo.
set /p opcao="Escolha uma opção: "

if "%opcao%"=="1" call instalar.bat
if "%opcao%"=="2" call configure-db.bat
if "%opcao%"=="3" call setup-db.bat
if "%opcao%"=="4" call resetar-senha-postgres.bat
if "%opcao%"=="5" call start.bat
if "%opcao%"=="6" call parar.bat
if "%opcao%"=="7" call status.bat
if "%opcao%"=="8" call verificar-portas.bat
if "%opcao%"=="9" call backup-banco.bat
if /i "%opcao%"=="R" call resetar-banco.bat
if /i "%opcao%"=="L" call limpar-cache.bat
if /i "%opcao%"=="B" call build.bat
if /i "%opcao%"=="D" call diagnostico.bat
if "%opcao%"=="0" exit /b 0

goto menu
