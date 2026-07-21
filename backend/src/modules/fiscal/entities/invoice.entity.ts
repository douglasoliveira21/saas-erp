import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { Certificate } from './certificate.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id', type: 'uuid', nullable: true })
  saleId: string;

  @Column({ name: 'certificate_id', type: 'uuid', nullable: true })
  certificateId: string;

  @Column({ type: 'varchar', length: 10 })
  type: string;

  @Column({ type: 'int', nullable: true })
  number: number;

  @Column({ type: 'int', default: 1 })
  series: number;

  @Column({ name: 'access_key', length: 100, nullable: true })
  accessKey: string;

  @Column({ name: 'protocol_number', length: 50, nullable: true })
  protocolNumber: string;

  @Column({ name: 'verification_code', length: 100, nullable: true })
  verificationCode: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string;

  @Column({ name: 'queue_status', type: 'varchar', length: 20, default: 'pendente' })
  queueStatus: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'next_retry_at', type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ name: 'xml_sent', type: 'text', nullable: true })
  xmlSent: string;

  @Column({ name: 'xml_authorized', type: 'text', nullable: true })
  xmlAuthorized: string;

  @Column({ name: 'xml_cancel', type: 'text', nullable: true })
  xmlCancel: string;

  @Column({ name: 'xml_storage_path', type: 'text', nullable: true })
  xmlStoragePath: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string;

  @Column({ name: 'cancel_protocol', length: 50, nullable: true })
  cancelProtocol: string;

  @Column({ name: 'correction_letter', type: 'text', nullable: true })
  correctionLetter: string;

  @Column({ name: 'correction_protocol', length: 80, nullable: true })
  correctionProtocol: string;

  @Column({ name: 'canceled_at', type: 'timestamp', nullable: true })
  canceledAt: Date;

  @Column({ name: 'issuer_cnpj', length: 20, nullable: true })
  issuerCnpj: string;

  @Column({ name: 'recipient_cnpj', length: 20, nullable: true })
  recipientCnpj: string;

  @Column({ name: 'recipient_name', length: 255, nullable: true })
  recipientName: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalValue: number;

  @Column({ type: 'int', default: 2 })
  environment: number;

  @Column({ name: 'city_code', length: 10, nullable: true })
  cityCode: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'issued_at', type: 'timestamp', nullable: true })
  issuedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Certificate)
  @JoinColumn({ name: 'certificate_id' })
  certificate: Certificate;
}
