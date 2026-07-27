import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

@Entity('portal_users')
export class PortalUser {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId: string;
  @Column({ length: 180 }) name: string;
  @Column({ length: 255, unique: true }) email: string;
  @Column({ length: 255 }) password: string;
  @Column({ length: 30, nullable: true }) phone: string;
  @Column({ length: 80, nullable: true }) department: string;
  @Column({ type: 'varchar', length: 20, default: 'user' }) role: 'admin' | 'manager' | 'finance' | 'user';
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: 'pending' | 'active' | 'blocked';
  @Column({ name: 'glpi_user_id', type: 'int', nullable: true }) glpiUserId: number | null;
  @Column({ name: 'approved_at', type: 'timestamp', nullable: true }) approvedAt: Date | null;
  @Column({ name: 'approved_by', type: 'uuid', nullable: true }) approvedBy: string | null;
  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true }) lastLoginAt: Date | null;
  @Column({ name: 'verification_code_hash', length: 64, nullable: true }) verificationCodeHash: string | null;
  @Column({ name: 'verification_expires_at', type: 'timestamp', nullable: true }) verificationExpiresAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @ManyToOne(() => Customer) @JoinColumn({ name: 'customer_id' }) customer: Customer;
}
