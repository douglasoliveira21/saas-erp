import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'banco' })
  type: string; // banco | caixa | carteira | inter

  @Column({ name: 'bank_name', length: 120, nullable: true })
  bankName: string;

  @Column({ length: 30, nullable: true })
  agency: string;

  @Column({ length: 40, nullable: true })
  account: string;

  @Column({ name: 'opening_balance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
