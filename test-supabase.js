const { Client } = require('pg');

const config = {
  host: 'db.opayspeyfojslopnczjn.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'qy1e7Cj8xiDf1I7n',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('Testando conexão com Supabase...');
console.log('Host:', config.host);
console.log('Porta:', config.port);
console.log('Usuário:', config.user);
console.log('Banco:', config.database);
console.log('');

const client = new Client(config);

client.connect()
  .then(() => {
    console.log('✅ CONECTADO COM SUCESSO!');
    return client.query('SELECT version()');
  })
  .then(result => {
    console.log('');
    console.log('Versão do PostgreSQL:');
    console.log(result.rows[0].version);
    return client.query('SELECT current_database(), current_user');
  })
  .then(result => {
    console.log('');
    console.log('Banco atual:', result.rows[0].current_database);
    console.log('Usuário atual:', result.rows[0].current_user);
    return client.end();
  })
  .then(() => {
    console.log('');
    console.log('✅ Teste concluído com sucesso!');
    process.exit(0);
  })
  .catch(err => {
    console.log('');
    console.log('❌ ERRO:', err.message);
    console.log('');
    if (err.code === 'ENOTFOUND') {
      console.log('O host não foi encontrado. Possíveis causas:');
      console.log('1. Projeto Supabase está pausado');
      console.log('2. Sem conexão com internet');
      console.log('3. Firewall bloqueando');
    } else if (err.code === '28P01') {
      console.log('Senha incorreta!');
    }
    process.exit(1);
  });
