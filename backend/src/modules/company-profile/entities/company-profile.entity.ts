import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Dados cadastrais do tenant usados em cabeçalhos de relatório/PDF (razão social, CNPJ, logo
// etc). Uma linha por tenant - separado de FiscalConfig porque aquele é um singleton global
// amarrado a numeração de NF-e/NFS-e, enquanto isto é por tenant e de uso mais genérico.
@Entity('company_profiles')
export class CompanyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', unique: true })
  tenantId: string;

  @Column({ name: 'razao_social', length: 255, nullable: true })
  razaoSocial: string;

  @Column({ length: 20, nullable: true })
  cnpj: string;

  @Column({ name: 'inscricao_estadual', length: 30, nullable: true })
  inscricaoEstadual: string;

  @Column({ name: 'inscricao_municipal', length: 30, nullable: true })
  inscricaoMunicipal: string;

  @Column({ length: 10, nullable: true })
  cep: string;

  @Column({ type: 'text', nullable: true })
  endereco: string;

  @Column({ length: 30, nullable: true })
  telefone: string;

  // Base64 data URL (mesmo formato de fiscal_config.companyLogo) - sem upload em disco, sem
  // multer, consistente com o único outro lugar do sistema que guarda logo.
  @Column({ type: 'text', nullable: true })
  logo: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
