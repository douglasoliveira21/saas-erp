import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('portal_ticket_forms')
export class PortalTicketForm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100, default: 'Formulário padrão' }) name: string;
  @Column({ default: true }) active: boolean;
  @Column({ name: 'customer_id', type: 'uuid', nullable: true }) customerId: string | null;
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` }) fields: Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }>;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
