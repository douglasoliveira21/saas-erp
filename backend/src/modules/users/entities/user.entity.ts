import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../../../common/enums/user-role.enum';
import { Sale } from '../../sales/entities/sale.entity';
import { Commission } from '../../commissions/entities/commission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    type: 'varchar',
    default: UserRole.TECNICO,
  })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Sale, (sale) => sale.technician)
  sales: Sale[];

  @OneToMany(() => Commission, (commission) => commission.technician)
  commissions: Commission[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];
}
