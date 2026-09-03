import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface PlanLimits {
  maxUsers?: number;
  maxInvoicesPerMonth?: number;
  maxServiceOrdersPerMonth?: number;
  maxStorageMb?: number;
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'billing_cycle', length: 20, default: 'mensal' })
  billingCycle: string;

  // Chaves de módulo habilitadas para tenants neste plano (ver frontend/src/components/navigation.ts
  // para o catálogo de módulos existentes hoje).
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  modules: string[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  limits: PlanLimits;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
