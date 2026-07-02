@echo off
chcp 65001 >nul
echo ============================================
echo   DIAGNOSTICO DE CONEXAO SUPABASE
echo ============================================
echo.

echo [1] Testando DNS - Conexao Direta...
nslookup db.opayspeyfojslopnczjn.supabase.co
echo.

echo [2] Testando DNS - Pooler us-east-2...
nslookup aws-1-us-east-2.pooler.supabase.com
echo.

echo [3] Testando DNS - Pooler us-east-1 (fallback)...
nslookup aws-0-us-east-1.pooler.supabase.com
echo.

echo [4] Testando porta 5432 no pooler us-east-2...
powershell -Command "Test-NetConnection -ComputerName aws-1-us-east-2.pooler.supabase.com -Port 5432 -InformationLevel Quiet"
echo.

echo [5] Testando porta 6543 no pooler us-east-2...
powershell -Command "Test-NetConnection -ComputerName aws-1-us-east-2.pooler.supabase.com -Port 6543 -InformationLevel Quiet"
echo.

echo [6] Testando conexao Node.js - Pooler session (5432)...
node -e "const {Client}=require('pg');const c=new Client({host:'aws-1-us-east-2.pooler.supabase.com',port:5432,user:'postgres.opayspeyfojslopnczjn',password:'sDeyiJcSdW4MBxXn',database:'postgres',ssl:{rejectUnauthorized:false},connectionTimeoutMillis:8000});c.connect().then(()=>{console.log('OK - Conectado com sucesso!');return c.end();}).catch(e=>console.error('FALHOU:',e.message,e.code));" 2>&1
echo.

echo [7] Testando conexao Node.js - Pooler transaction (6543)...
node -e "const {Client}=require('pg');const c=new Client({host:'aws-1-us-east-2.pooler.supabase.com',port:6543,user:'postgres.opayspeyfojslopnczjn',password:'sDeyiJcSdW4MBxXn',database:'postgres',ssl:{rejectUnauthorized:false},connectionTimeoutMillis:8000});c.connect().then(()=>{console.log('OK - Conectado com sucesso!');return c.end();}).catch(e=>console.error('FALHOU:',e.message,e.code));" 2>&1
echo.

echo [8] Verificando suporte IPv6 da sua rede...
powershell -Command "Test-NetConnection -ComputerName ipv6.google.com -Port 80 -InformationLevel Quiet" 2>nul
if %errorlevel%==0 (echo IPv6: SUPORTADO) else (echo IPv6: NAO SUPORTADO - isso explica falha na conexao direta)
echo.

echo [9] Pegando connection string do painel Supabase via API...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'https://opayspeyfojslopnczjn.supabase.co/rest/v1/' -Headers @{'apikey'='sb_publishable_5U35GEQYmqQsip3fNpdwKA_HGCOgUcuDIRECT'} -TimeoutSec 5; Write-Host 'API REST: ACESSIVEL (status' $r.StatusCode ')' } catch { Write-Host 'API REST: ERRO -' $_.Exception.Message }"
echo.

echo ============================================
echo   FIM DO DIAGNOSTICO
echo ============================================
pause
