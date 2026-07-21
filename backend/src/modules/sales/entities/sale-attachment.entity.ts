import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sale } from './sale.entity';

@Entity('sale_attachments')
export class SaleAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @Column({ length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 50, default: 'outro' })
  type: string;

  @Column({ name: 'mime_type', length: 120, nullable: true })
  mimeType: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Sale, (sale) => sale.attachments)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
