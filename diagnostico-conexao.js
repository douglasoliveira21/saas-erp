const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     DIAGNÓSTICO DE CONEXÃO POSTGRESQL                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📋 Configuração atual do .env:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`HOST:     ${process.env.DATABASE_HOST || 'localhost'}`);
console.log(`PORT:     ${process.env.DATABASE_PORT || '5432'}`);
console.log(`USER:     ${process.env.DATABASE_USER || 'postgres'}`);
console.log(`PASSWORD: ${process.env.DATABASE_PASSWORD ? '***' + process.env.DATABASE_PASSWORD.slice(-3) : '(vazia)'}`);
console.log(`DATABASE: ${process.env.DATABASE_NAME || 'gestao_ti'}`);
console.log('─────────────────────────────────────────────────────────────\n');

// Lista de senhas para testar
const senhasTeste = [
  '',
  'postgres',
  'admin',
  'root',
  'password',
  '123456',
  'Vsi@#$3303Vsi'
];

async function testarConexao(senha, index, total) {
  const senhaDisplay = senha === '' ? '(vazia)' : senha;
  console.log(`[${index}/${total}] Testando senha: ${senhaDisplay}`);
  
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    user: process.env.DATABASE_USER || 'postgres',
    password: senha,
    database: 'postgres', // Conectar ao banco padrão primeiro
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    
    console.log(`✅ SUCESSO! Senha encontrada: ${senhaDisplay}\n`);
    return senha;
  } catch (error) {
    console.log(`❌ Falhou: ${error.message}\n`);
    return null;
  }
}

async function testarTodasSenhas() {
  console.log('🔍 Testando senhas comuns...\n');
  
  for (let i = 0; i < senhasTeste.length; i++) {
    const senhaCorreta = await testarConexao(senhasTeste[i], i + 1, senhasTeste.length);
    
    if (senhaCorreta !== null) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ SENHA CORRETA ENCONTRADA!');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      console.log('📝 Atualize o arquivo backend/.env com:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`DATABASE_PASSWORD=${senhaCorreta}`);
      console.log('─────────────────────────────────────────────────────────────\n');
      
      // Tentar atualizar automaticamente
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, 'backend', '.env');
      
      try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(
          /DATABASE_PASSWORD=.*/,
          `DATABASE_PASSWORD=${senhaCorreta}`
        );
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Arquivo .env atualizado automaticamente!\n');
      } catch (err) {
        console.log('⚠️  Não foi possível atualizar automaticamente.');
        console.log('   Por favor, atualize manualmente.\n');
      }
      
      console.log('🎯 Próximos passos:');
      console.log('1. Execute: setup-db.bat');
      console.log('2. Execute: start.bat\n');
      
      return;
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('❌ NENHUMA SENHA COMUM FUNCIONOU');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('🆘 Possíveis soluções:\n');
  console.log('1. Verifique se o PostgreSQL está rodando:');
  console.log('   - Abra "Serviços" do Windows');
  console.log('   - Procure por "postgresql"');
  console.log('   - Verifique se está "Em execução"\n');
  
  console.log('2. Verifique o arquivo pg_hba.conf:');
  console.log('   C:\\Program Files\\PostgreSQL\\[versão]\\data\\pg_hba.conf');
  console.log('   Deve ter uma linha como:');
  console.log('   host    all    all    127.0.0.1/32    md5\n');
  
  console.log('3. Tente resetar a senha do PostgreSQL:');
  console.log('   - Mude "md5" para "trust" no pg_hba.conf');
  console.log('   - Reinicie o PostgreSQL');
  console.log('   - Execute: psql -U postgres');
  console.log('   - Execute: ALTER USER postgres PASSWORD \'nova_senha\';');
  console.log('   - Volte "trust" para "md5" no pg_hba.conf');
  console.log('   - Reinicie o PostgreSQL novamente\n');
}

testarTodasSenhas().catch(err => {
  console.error('❌ Erro ao executar diagnóstico:', err);
  process.exit(1);
});
