import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Contract } from '../../contracts/entities/contract.entity';

@Entity('glpi_tickets')
export class GlpiTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'glpi_ticket_id', type: 'int' })
  glpiTicketId: number;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string;

  @Column({ name: 'contract_id', type: 'uuid', nullable: true })
  contractId: string;

  @Column({ name: 'glpi_entity_id', type: 'int', nullable: true })
  glpiEntityId: number;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'int', nullable: true })
  status: number;

  @Column({ type: 'int', nullable: true })
  type: number;

  @Column({ type: 'int', nullable: true })
  priority: number;

  @Column({ name: 'date_opened', type: 'timestamp', nullable: true })
  dateOpened: Date;

  @Column({ name: 'date_closed', type: 'timestamp', nullable: true })
  dateClosed: Date;

  @Column({ name: 'date_solved', type: 'timestamp', nullable: true })
  dateSolved: Date;

  @Column({ name: 'sla_type', type: 'varchar', length: 20, nullable: true })
  slaType: string;

  @Column({ name: 'sla_limit_hours', type: 'decimal', precision: 10, scale: 2, nullable: true })
  slaLimitHours: number;

  @Column({ name: 'time_spent_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  timeSpentHours: number;

  @Column({ name: 'sla_exceeded', default: false })
  slaExceeded: boolean;

  @Column({ name: 'exceeded_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  exceededHours: number;

  @Column({ name: 'exceeded_charge', type: 'decimal', precision: 10, scale: 2, default: 0 })
  exceededCharge: number;

  @Column({ name: 'charge_rate', type: 'decimal', precision: 10, scale: 2, default: 80 })
  chargeRate: number;

  @Column({ name: 'synced_at', type: 'timestamp', nullable: true })
  syncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;
}
