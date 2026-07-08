import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('bank_statements')
export class BankStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', length: 100, nullable: true })
  transactionId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10 })
  type: string; // credito | debito

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  memo: string;

  @Column({ name: 'document_number', type: 'varchar', length: 100, nullable: true })
  documentNumber: string;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bankAccount: string;

  @Column({ type: 'varchar', length: 30, default: 'pendente' })
  status: string; // pendente | conciliado_auto | conciliado_manual | divergente | ignorado

  @Column({ name: 'matched_movement_id', type: 'uuid', nullable: true })
  matchedMovementId: string;

  @Column({ name: 'match_score', type: 'int', nullable: true })
  matchScore: number;

  @Column({ name: 'reconciled_by', type: 'uuid', nullable: true })
  reconciledBy: string;

  @Column({ name: 'reconciled_at', type: 'timestamp', nullable: true })
  reconciledAt: Date;

  @Column({ name: 'import_batch', type: 'varchar', length: 100, nullable: true })
  importBatch: string;

  @Column({ name: 'category', type: 'varchar', length: 50, nullable: true })
  category: string; // tarifa | juros | iof | rendimento | estorno | ted | doc | pix | boleto | transferencia | deposito | saque | outros

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
