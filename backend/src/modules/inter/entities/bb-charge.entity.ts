import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('bb_charges')
export class BbCharge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'config_id', type: 'uuid' }) configId: string;
  @Column() kind: string;
  @Column({ name: 'external_id' }) externalId: string;
  @Column({ name: 'request_key' }) requestKey: string;
  @Column({ type: 'jsonb' }) payload: Record<string, any>;
  @Column({ type: 'jsonb', default: {} }) response: Record<string, any>;
  @Column({ default: 'novo' }) state: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
