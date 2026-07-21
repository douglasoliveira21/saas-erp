import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fiscal_events')
export class FiscalEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string;

  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  status: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
