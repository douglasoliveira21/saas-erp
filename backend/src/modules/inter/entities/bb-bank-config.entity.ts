import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bb_bank_configs')
export class BbBankConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ default: true }) current: boolean;
  @Column({ default: false }) active: boolean;
  @Column({ default: 'sandbox' }) environment: string;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, any>;
  @Column({ type: 'text' }) credentials: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
