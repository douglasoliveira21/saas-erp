import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Purchase } from './purchase.entity';

@Entity('purchase_attachments')
export class PurchaseAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @Column({ length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // xml | pdf | outro

  @Column({ name: 'mime_type', length: 120, nullable: true })
  mimeType: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Purchase, (purchase) => purchase.attachments)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;
}
