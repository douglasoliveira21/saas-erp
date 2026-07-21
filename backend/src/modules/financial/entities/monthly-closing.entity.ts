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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
