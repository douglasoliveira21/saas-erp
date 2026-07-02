import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { RouteLeg } from './route-leg.entity';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'technician_id' })
  technicianId: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string;

  @Column({ length: 255 })
  description: string;

  // Mantidos para compatibilidade mas calculados a partir dos legs
  @Column({ length: 255, nullable: true })
  origin: string;

  @Column({ length: 255, nullable: true })
  destination: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  km: number;

  @Column({ name: 'rate_per_km', type: 'decimal', precision: 10, scale: 2, default: 1.30 })
  ratePerKm: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2 })
  totalValue: number;

  @Column({ type: 'varchar', default: 'pendente' })
  status: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'route_date', type: 'date' })
  routeDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'technician_id' })
  technician: User;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'paid_by' })
  payer: User;

  @OneToMany(() => RouteLeg, (leg) => leg.route, { cascade: true, eager: true })
  legs: RouteLeg[];
}
