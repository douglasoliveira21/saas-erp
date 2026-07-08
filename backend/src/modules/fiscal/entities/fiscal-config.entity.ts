import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fiscal_config')
export class FiscalConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  cnpj: string;

  @Column({ name: 'company_name', length: 255 })
  companyName: string;

  @Column({ name: 'state_registration', length: 20, nullable: true })
  stateRegistration: string;

  @Column({ name: 'city_registration', length: 20, nullable: true })
  cityRegistration: string;

  @Column({ name: 'tax_regime', type: 'int', default: 1 })
  taxRegime: number;

  @Column({ name: 'nfe_series', type: 'int', default: 1 })
  nfeSeries: number;

  @Column({ name: 'nfe_next_number', type: 'int', default: 1 })
  nfeNextNumber: number;

  @Column({ name: 'nfse_series', type: 'int', default: 1 })
  nfseSeries: number;

  @Column({ name: 'nfse_next_number', type: 'int', default: 1 })
  nfseNextNumber: number;

  @Column({ type: 'int', default: 2 })
  environment: number;

  @Column({ name: 'uf_code', length: 2, default: '31' })
  ufCode: string;

  @Column({ name: 'city_code', length: 7, default: '3118601' })
  cityCode: string;

  @Column({ name: 'nfse_api_url', length: 500, nullable: true })
  nfseApiUrl: string;

  @Column({ name: 'nfse_test_url', length: 500, nullable: true })
  nfseTestUrl: string;

  // Endereco do emitente (obrigatorio para NF-e)
  @Column({ name: 'emit_address', length: 255, nullable: true })
  emitAddress: string;

  @Column({ name: 'emit_number', length: 60, nullable: true })
  emitNumber: string;

  @Column({ name: 'emit_neighborhood', length: 100, nullable: true })
  emitNeighborhood: string;

  @Column({ name: 'emit_cep', length: 10, nullable: true })
  emitCep: string;

  @Column({ name: 'emit_phone', length: 20, nullable: true })
  emitPhone: string;

  // NFC-e
  @Column({ name: 'nfce_series', type: 'int', default: 1, nullable: true })
  nfceSeries: number;

  @Column({ name: 'nfce_next_number', type: 'int', default: 1, nullable: true })
  nfceNextNumber: number;

  @Column({ name: 'nfce_csc_id', length: 10, nullable: true })
  nfceCscId: string;

  @Column({ name: 'nfce_csc_token', length: 100, nullable: true })
  nfceCscToken: string;

  @Column({ name: 'company_logo', type: 'text', nullable: true })
  companyLogo: string; // base64 encoded logo image

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
