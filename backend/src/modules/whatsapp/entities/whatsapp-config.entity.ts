import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_config')
export class WhatsappConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'api_url', length: 500, nullable: true })
  apiUrl: string;

  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey: string;

  @Column({ name: 'instance_name', length: 100, nullable: true })
  instanceName: string;

  @Column({ name: 'connection_status', length: 20, default: 'desconectado' })
  connectionStatus: string;

  @Column({ name: 'phone_number', length: 30, nullable: true })
  phoneNumber: string;

  @Column({ name: 'last_checked_at', type: 'timestamp', nullable: true })
  lastCheckedAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string;

  @Column({ name: 'notify_service_orders', default: true })
  notifyServiceOrders: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
