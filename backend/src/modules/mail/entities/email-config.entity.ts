import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_configs')
export class EmailConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, nullable: true })
  host: string;

  @Column({ type: 'int', default: 587 })
  port: number;

  @Column({ default: false })
  secure: boolean;

  @Column({ name: 'auth_user', length: 255, nullable: true })
  authUser: string;

  @Column({ name: 'auth_pass', type: 'text', nullable: true })
  authPass: string;

  @Column({ name: 'from_email', length: 255, nullable: true })
  fromEmail: string;

  @Column({ name: 'from_name', length: 255, nullable: true })
  fromName: string;

  @Column({ name: 'copy_enabled', default: false })
  copyEnabled: boolean;

  @Column({ name: 'copy_email', length: 255, nullable: true })
  copyEmail: string;

  @Column({ length: 30, default: 'smtp' })
  provider: string;

  @Column({ name: 'microsoft_tenant_id', length: 255, nullable: true })
  microsoftTenantId: string;

  @Column({ name: 'microsoft_client_id', length: 255, nullable: true })
  microsoftClientId: string;

  @Column({ name: 'microsoft_client_secret', type: 'text', nullable: true })
  microsoftClientSecret: string;

  @Column({ name: 'microsoft_redirect_uri', type: 'text', nullable: true })
  microsoftRedirectUri: string;

  @Column({ name: 'microsoft_refresh_token', type: 'text', nullable: true })
  microsoftRefreshToken: string;

  @Column({ name: 'microsoft_access_token', type: 'text', nullable: true })
  microsoftAccessToken: string;

  @Column({ name: 'microsoft_token_expires_at', type: 'timestamp', nullable: true })
  microsoftTokenExpiresAt: Date;

  @Column({ name: 'microsoft_user_email', length: 255, nullable: true })
  microsoftUserEmail: string;

  @Column({ name: 'microsoft_state', length: 100, nullable: true })
  microsoftState: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
