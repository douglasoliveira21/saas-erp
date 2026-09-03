import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Catálogo de plataforma (não pertence a nenhum tenant) — lista quais bancos já têm
// integração real (emissão de boleto / captura de pagamento) disponível no sistema.
@Entity('banks')
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 10, nullable: true })
  code: string | null;

  @Column({ name: 'has_integration', default: false })
  hasIntegration: boolean;

  @Column({ length: 60, nullable: true })
  provider: string | null;

  @Column({ length: 20, default: 'nao_suportado' })
  status: 'suportado' | 'em_teste' | 'nao_suportado';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
