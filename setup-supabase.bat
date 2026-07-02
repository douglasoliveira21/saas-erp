@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     CONFIGURAR SUPABASE - Sistema de Gestão TI            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 🚀 Este script vai configurar o banco de dados Supabase
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Verificar se o arquivo .env existe
if not exist "backend\.env" (
    echo ❌ Arquivo backend\.env não encontrado!
    echo.
    echo Copiando do .env.example...
    copy backend\.env.example backend\.env >nul
    echo ✅ Arquivo criado!
    echo.
)

echo 📋 PASSO 1: Configurar Senha do Supabase
echo.
echo Por favor, digite a senha do seu banco Supabase:
echo (Você pode encontrar em: Supabase Dashboard → Settings → Database)
echo.
set /p supabase_password="Senha do Supabase: "

if "%supabase_password%"=="" (
    echo.
    echo ❌ Senha não pode ser vazia!
    echo.
    pause
    exit /b 1
)

echo.
echo Atualizando arquivo .env...

REM Atualizar a senha no .env
powershell -Command "(Get-Content 'backend\.env') -replace 'DATABASE_PASSWORD=.*', 'DATABASE_PASSWORD=%supabase_password%' | Set-Content 'backend\.env'"

echo ✅ Senha configurada!
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📋 PASSO 2: Testar Conexão
echo.

cd backend
node ../testar-conexao-supabase.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Erro ao conectar com Supabase!
    echo.
    echo Verifique:
    echo 1. A senha está correta?
    echo 2. O Supabase está ativo?
    echo 3. As configurações de rede permitem conexão?
    echo.
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📋 PASSO 3: Executar Migrations (Criar Tabelas)
echo.

echo Criando estrutura do banco de dados...
cd backend
npm run migration:run

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Migrations falharam, tentando criar manualmente...
    echo.
    
    REM Tentar executar o SQL diretamente
    psql "postgresql://postgres:%supabase_password%@db.opayspeyfojslopnczjn.supabase.co:5432/postgres" -f ../database/schema.sql
    
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Erro ao criar tabelas!
        cd ..
        pause
        exit /b 1
    )
)

cd ..

echo ✅ Tabelas criadas!
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📋 PASSO 4: Inserir Dados Iniciais (Seeds)
echo.

echo Inserindo dados de teste...
cd backend
npm run seed

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Seed falhou, mas o banco está configurado.
    echo    Você pode adicionar dados manualmente depois.
    echo.
) else (
    echo ✅ Dados iniciais inseridos!
    echo.
)

cd ..

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✅ CONFIGURAÇÃO CONCLUÍDA!
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 🎯 PRÓXIMOS PASSOS:
echo.
echo 1. Execute: start.bat
echo    (Inicia o sistema)
echo.
echo 2. Acesse: http://localhost:5001
echo.
echo 3. Login:
echo    Email: admin@gestao.com
echo    Senha: admin123
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 📊 Informações do Supabase:
echo    URL: https://opayspeyfojslopnczjn.supabase.co
echo    Host: db.opayspeyfojslopnczjn.supabase.co
echo    Porta: 5432
echo    Banco: postgres
echo.
echo ═══════════════════════════════════════════════════════════
echo.
pause
