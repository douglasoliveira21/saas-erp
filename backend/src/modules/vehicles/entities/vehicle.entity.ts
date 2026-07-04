import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, unique: true })
  plate: string;

  @Column({ length: 100, nullable: true })
  brand: string;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ length: 50, nullable: true })
  color: string;

  @Column({ type: 'int', nullable: true })
  year: number;

  @Column({ name: 'year_model', type: 'int', nullable: true })
  yearModel: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fuel: string;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 20, nullable: true, default: 'carro' })
  vehicleType: string;

  @Column({ name: 'technician_id', type: 'uuid', nullable: true })
  technicianId: string;

  @Column({ name: 'rate_per_km', type: 'decimal', precision: 10, scale: 2, default: 1.30 })
  ratePerKm: number;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'technician_id' })
  technician: User;
}
