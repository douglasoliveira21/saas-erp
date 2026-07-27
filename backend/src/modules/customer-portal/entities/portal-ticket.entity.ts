import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PortalUser } from './portal-user.entity';

@Entity('portal_tickets')
export class PortalTicket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId: string;
  @Column({ name: 'portal_user_id', type: 'uuid' }) portalUserId: string;
  @Column({ name: 'glpi_ticket_id', type: 'int', unique: true }) glpiTicketId: number;
  @Column({ name: 'glpi_entity_id', type: 'int' }) glpiEntityId: number;
  @Column({ length: 500 }) title: string;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'int', default: 1 }) type: number;
  @Column({ type: 'int', default: 3 }) urgency: number;
  @Column({ type: 'int', default: 1 }) status: number;
  @Column({ name: 'form_data', type: 'jsonb', default: () => `'{}'::jsonb` }) formData: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @ManyToOne(() => PortalUser) @JoinColumn({ name: 'portal_user_id' }) requester: PortalUser;
}
