import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Executa o seed automaticamente se a tabela users estiver vazia.
 * Chamado durante a inicialização do backend.
 */
export async function seedOnStart(dataSource: DataSource): Promise<void> {
  try {
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
