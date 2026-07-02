import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('glpi_config')
export class GlpiConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'api_url', length: 500 })
  apiUrl: string;

  @Column({ name: 'app_token', length: 255 })
  appToken: string;

  @Column({ name: 'user_token', length: 255, nullable: true })
  userToken: string;

  @Column({ name: 'session_token', length: 255, nullable: true })
  sessionToken: string;

  @Column({ name: 'last_sync', type: 'timestamp', nullable: true })
  lastSync: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
