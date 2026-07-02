import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Route } from './route.entity';

@Entity('route_legs')
export class RouteLeg {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id' })
  routeId: string;

  @Column({ length: 255 })
  origin: string;

  @Column({ length: 255 })
  destination: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  km: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Route, (route) => route.legs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;
}
