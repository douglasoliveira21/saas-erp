import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SuperAdmin } from './super-admin.entity';

// Código de 6 dígitos enviado por email como segundo fator do login do super admin - nunca
// guarda o código em texto puro, só o hash (mesmo padrão de password_resets), e é de uso único
// e curta duração (ver expiresAt/used em super-admin-auth.service.ts).
@Entity('super_admin_login_codes')
export class SuperAdminLoginCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'super_admin_id' })
  superAdminId: string;

  @Column({ name: 'code_hash', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SuperAdmin)
  @JoinColumn({ name: 'super_admin_id' })
  superAdmin: SuperAdmin;
}
