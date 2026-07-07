import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function ensureOperationalTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
      customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
      type VARCHAR(20) NOT NULL,
      codigo_solicitacao VARCHAR(100),
      status VARCHAR(30) DEFAULT 'a_receber',
      value DECIMAL(10, 2) NOT NULL DEFAULT 0,
      customer_name VARCHAR(255),
      customer_doc VARCHAR(20),
      due_date DATE,
      linha_digitavel TEXT,
      pix_copia_e_cola TEXT,
      nosso_numero VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dataSource.query('CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id)');
  await dataSource.query('CREATE INDEX IF NOT EXISTS idx_payments_codigo_solicitacao ON payments(codigo_solicitacao)');
  await dataSource.query('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)');
  await dataSource.query('CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)');
}

/**
 * Executa o seed automaticamente se a tabela users estiver vazia.
 * Chamado durante a inicialização do backend.
 */
export async function seedOnStart(dataSource: DataSource): Promise<void> {
  try {
    await ensureOperationalTables(dataSource);

    // Verifica se a tabela users existe e se há registros
    const queryRunner = dataSource.createQueryRunner();

    const tableExists = await queryRunner.hasTable('users');
    if (!tableExists) {
      console.log('⏳ Tabela users ainda não existe. O synchronize vai criá-la...');
      await queryRunner.release();
      return;
    }

    const userCount = await queryRunner.query('SELECT COUNT(*) as count FROM users');
    await queryRunner.release();

    if (parseInt(userCount[0].count) > 0) {
      console.log('✅ Banco já possui usuários cadastrados. Seed ignorado.');
      return;
    }

    console.log('🌱 Banco vazio detectado. Criando usuários padrão...');

    const adminHash = await bcrypt.hash('Admin@123', 10);
    const financeiroHash = await bcrypt.hash('Financeiro@123', 10);
    const tecnicoHash = await bcrypt.hash('Tecnico@123', 10);

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, active) VALUES
      ('Administrador', 'admin@empresa.com', $1, 'admin', true),
      ('Maria Financeiro', 'financeiro@empresa.com', $2, 'financeiro', true),
      ('João Técnico', 'tecnico@empresa.com', $3, 'tecnico', true),
      ('Pedro Técnico', 'pedro@empresa.com', $3, 'tecnico', true)
      ON CONFLICT DO NOTHING
    `, [adminHash, financeiroHash, tecnicoHash]);

    console.log('✅ Usuários padrão criados com sucesso!');
    console.log('');
    console.log('📋 Credenciais:');
    console.log('   Admin:      admin@empresa.com / Admin@123');
    console.log('   Financeiro: financeiro@empresa.com / Financeiro@123');
    console.log('   Técnico:    tecnico@empresa.com / Tecnico@123');
    console.log('');
  } catch (error) {
    console.warn('⚠️  Seed automático falhou (pode ser que as tabelas ainda não existam):', error.message);
  }
}
