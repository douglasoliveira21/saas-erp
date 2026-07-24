import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'device_name', length: 255, nullable: true }) deviceName: string;
  @Column({ name: 'user_agent', type: 'text', nullable: true }) userAgent: string;
  @Column({ name: 'ip_address', length: 64, nullable: true }) ipAddress: string;
  @Column({ name: 'last_seen_at', type: 'timestamp' }) lastSeenAt: Date;
  @Column({ name: 'expires_at', type: 'timestamp' }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true }) revokedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
}
