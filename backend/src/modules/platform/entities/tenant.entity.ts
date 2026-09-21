import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Plan } from './plan.entity';
import { Bank } from './bank.entity';
import { Municipality } from './municipality.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 80, unique: true })
  slug: string;

  @Column({ length: 20, nullable: true })
  document: string;

  // 'ativo' | 'suspenso' | 'cancelado'
  @Column({ length: 20, default: 'ativo' })
  status: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string;

  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  // Qual banco (catálogo em banks) e qual município (catálogo em municipalities, pra NFS-e) este
  // tenant usa. Ambos opcionais: um tenant sem nenhum dos dois configurado cai no comportamento
  // legado (variáveis de ambiente globais do Inter / Contagem-Cidade360 fixo), exatamente como
  // era antes desta coluna existir.
  @Column({ name: 'bank_id', type: 'uuid', nullable: true })
  bankId: string | null;

  @Column({ name: 'municipality_id', type: 'uuid', nullable: true })
  municipalityId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @ManyToOne(() => Bank)
  @JoinColumn({ name: 'bank_id' })
  bank: Bank;

  @ManyToOne(() => Municipality)
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;
}
