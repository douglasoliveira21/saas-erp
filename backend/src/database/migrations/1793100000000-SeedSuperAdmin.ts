import { MigrationInterface, QueryRunner } from 'typeorm';

// Semeia a primeira conta de super admin. A senha abaixo é um hash bcrypt de uma senha
// aleatória gerada uma única vez ao escrever esta migração — nunca fica em texto puro no
// repositório. Troque a senha pelo painel assim que fizer o primeiro login.
export class SeedSuperAdmin1793100000000 implements MigrationInterface {
  name = 'SeedSuperAdmin1793100000000';

  async up(q: QueryRunner): Promise<void> {
    const existing = await q.query(`SELECT id FROM super_admins LIMIT 1`);
    if (existing.length) return; // já existe algum super admin, não sobrescreve

    await q.query(
      `INSERT INTO super_admins (name, email, password, active) VALUES ($1, $2, $3, true)`,
      ['Super Admin', 'douglassouza62@gmail.com', '$2b$12$gRBbUo3VLm40lgMtWwqFTuUB3nW5IbD8zYf2PSkIYzchbjnKgiGKy'],
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM super_admins WHERE email = $1`, ['douglassouza62@gmail.com']);
  }
}
