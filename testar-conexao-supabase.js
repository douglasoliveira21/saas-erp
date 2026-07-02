const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     TESTE DE CONEXÃO SUPABASE                              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📋 Configuração:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`HOST:     ${process.env.DATABASE_HOST}`);
console.log(`PORT:     ${process.env.DATABASE_PORT}`);
console.log(`USER:     ${process.env.DATABASE_USER}`);
console.log(`PASSWORD: ${process.env.DATABASE_PASSWORD ? '***' + process.env.DATABASE_PASSWORD.slice(-4) : '(não configurada)'}`);
console.log(`DATABASE: ${process.env.DATABASE_NAME}`);
console.log('─────────────────────────────────────────────────────────────\n');

async function testarConexao() {
  console.log('🔍 Testando conexão com Supabase...\n');
  
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: {
      rejectUnauthorized: false // Supabase requer SSL
    }
  });

  try {
    console.log('⏳ Conectando...');
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');
    
    console.log('⏳ Testando query...');
    const result = await client.query('SELECT version()');
    console.log('✅ Query executada com sucesso!\n');
    
    console.log('📊 Versão do PostgreSQL:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(result.rows[0].version);
    console.log('─────────────────────────────────────────────────────────────\n');
    
    // Verificar se as tabelas já existem
    console.log('🔍 Verificando tabelas existentes...\n');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 Tabelas encontradas:');
      console.log('─────────────────────────────────────────────────────────────');
      tablesResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
      console.log('─────────────────────────────────────────────────────────────\n');
    } else {
      console.log('⚠️  Nenhuma tabela encontrada. Execute as migrations.\n');
    }
    
    await client.end();
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CONEXÃO COM SUPABASE FUNCIONANDO!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return true;
  } catch (error) {
    console.log('❌ ERRO AO CONECTAR!\n');
    console.log('Detalhes do erro:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Mensagem: ${error.message}`);
    console.log(`Código: ${error.code || 'N/A'}`);
    console.log('─────────────────────────────────────────────────────────────\n');
    
    console.log('🆘 Possíveis causas:\n');
    console.log('1. ❌ Senha incorreta');
    console.log('   → Verifique a senha no Supabase Dashboard');
    console.log('   → Settings → Database → Database Password\n');
    
    console.log('2. ❌ Projeto Supabase pausado');
    console.log('   → Acesse: https://opayspeyfojslopnczjn.supabase.co');
    console.log('   → Verifique se o projeto está ativo\n');
    
    console.log('3. ❌ Firewall bloqueando conexão');
    console.log('   → Verifique configurações de rede');
    console.log('   → Tente desabilitar firewall temporariamente\n');
    
    console.log('4. ❌ SSL não configurado');
    console.log('   → Supabase requer conexão SSL');
    console.log('   → Verifique se ssl: true está configurado\n');
    
    try {
      await client.end();
    } catch (e) {
      // Ignorar erro ao fechar conexão
    }
    
    process.exit(1);
  }
}

testarConexao().catch(err => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
