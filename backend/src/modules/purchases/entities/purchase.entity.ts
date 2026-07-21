import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PurchaseItem } from './purchase-item.entity';
import { PurchaseQuote } from './purchase-quote.entity';
import { PurchaseAttachment } from './purchase-attachment.entity';

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // solicitacao | cotacao | ordem_compra | aprovacao | entrada | devolucao

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string; // pendente | aprovado | recebido | cancelado | devolvido

  @Column({ length: 255 })
  description: string;

  @Column({ name: 'supplier_name', length: 255 })
  supplierName: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'supplier_cnpj', length: 20, nullable: true })
  supplierCnpj: string;

  @Column({ type: 'text', nullable: true })
  items: string; // JSON string with items

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod: string;

  @Column({ name: 'cost_center_id', type: 'uuid', nullable: true })
  costCenterId: string;

  @Column({ name: 'chart_account_id', type: 'uuid', nullable: true })
  chartAccountId: string;

  @Column({ name: 'competence_date', type: 'date', nullable: true })
  competenceDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate: string;

  @Column({ name: 'invoice_number', length: 100, nullable: true })
  invoiceNumber: string;

  @Column({ name: 'selected_quote_id', type: 'uuid', nullable: true })
  selectedQuoteId: string;

  @Column({ name: 'approval_limit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  approvalLimit: number;

  @Column({ name: 'partially_received', type: 'boolean', default: false })
  partiallyReceived: boolean;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
  itemsList: PurchaseItem[];

  @OneToMany(() => PurchaseQuote, (quote) => quote.purchase, { cascade: true })
  quotes: PurchaseQuote[];

  @OneToMany(() => PurchaseAttachment, (attachment) => attachment.purchase, { cascade: true })
  attachments: PurchaseAttachment[];
}
