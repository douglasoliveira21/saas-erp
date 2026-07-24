import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('monthly_closings')
export class MonthlyClosing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 7, unique: true })
  period: string; // YYYY-MM

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string;

  @Column({ name: 'closed_at', type: 'timestamp' })
  closedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 20, default: 'fechado' })
  status: string;

  @Column({ name: 'reopened_by', type: 'uuid', nullable: true })
  reopenedBy: string;

  @Column({ name: 'reopened_at', type: 'timestamp', nullable: true })
  reopenedAt: Date;

  @Column({ name: 'reopen_reason', type: 'text', nullable: true })
  reopenReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
