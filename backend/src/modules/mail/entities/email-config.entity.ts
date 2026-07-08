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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
