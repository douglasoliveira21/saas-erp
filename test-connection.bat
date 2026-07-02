@echo off
echo 🔍 Testando conexão com PostgreSQL...
echo.
echo Servidor: 192.168.25.100
echo Porta: 5432
echo Usuário: postgres
echo Banco: gestao_ti
echo.

REM Testar conexão
psql -h 192.168.25.100 -U postgres -p 5432 -d postgres -c "SELECT version();"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Conexão bem-sucedida!
    echo.
    echo Agora você pode executar: npm run dev
) else (
    echo.
    echo ❌ Não foi possível conectar ao PostgreSQL
    echo.
    echo Possíveis causas:
    echo 1. PostgreSQL não está rodando em 192.168.25.100
    echo 2. Firewall bloqueando porta 5432
    echo 3. pg_hba.conf não permite conexões remotas
    echo 4. Senha incorreta
    echo.
    echo Consulte: CONFIGURAR_POSTGRESQL.md
)

echo.
pause
