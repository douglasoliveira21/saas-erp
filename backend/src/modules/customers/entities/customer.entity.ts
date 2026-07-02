import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'cpf_cnpj', length: 20, nullable: true })
  cpfCnpj: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'state_registration', length: 30, nullable: true })
  stateRegistration: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 2, nullable: true })
  uf: string;

  @Column({ length: 100, nullable: true })
  neighborhood: string;

  @Column({ length: 10, nullable: true })
  cep: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'glpi_entity_id', type: 'int', nullable: true })
  glpiEntityId: number;

  @Column({ name: 'glpi_entity_name', length: 255, nullable: true })
  glpiEntityName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];
}
