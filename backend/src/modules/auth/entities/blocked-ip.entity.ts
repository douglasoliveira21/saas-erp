import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Contador de tentativas de login falhas POR IP, independente de qual conta (ou se a conta nem
// existe) foi tentada - complementa o bloqueio por conta que já existia em users.locked_until
// (esse é por email/conta especifica; este aqui é por origem da requisição). Depois de
// FAILED_IP_LIMIT falhas, blocked vira true e todo login vindo desse IP é recusado até um super
// admin desbloquear pelo painel.
@Entity('blocked_ips')
export class BlockedIp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 64 })
  ip: string;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts: number;

  @Column({ default: false })
  blocked: boolean;

  @Column({ name: 'blocked_at', type: 'timestamp', nullable: true })
  blockedAt: Date | null;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ name: 'last_email_attempted', length: 255, nullable: true })
  lastEmailAttempted: string | null;

  @Column({ name: 'unblocked_at', type: 'timestamp', nullable: true })
  unblockedAt: Date | null;

  @Column({ name: 'unblocked_by', type: 'uuid', nullable: true })
  unblockedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
