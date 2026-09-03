import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Credenciais do Banco Inter por tenant (mTLS + OAuth2 client_credentials), criptografadas em
// repouso com o mesmo esquema já usado para WhatsApp/GLPI (common/security/field-encryption.ts).
// Quando um tenant não tem linha aqui, o InterService cai para as variáveis de ambiente globais
// (INTER_CLIENT_ID/INTER_CLIENT_SECRET/INTER_CERT_PATH/INTER_KEY_PATH/INTER_ACCOUNT) — é assim
// que o tenant legado (VGON) continua funcionando sem precisar de nenhuma migração de dados.
@Entity('tenant_bank_configs')
export class TenantBankConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', unique: true })
  tenantId: string;

  @Column({ name: 'bank_id', type: 'uuid', nullable: true })
  bankId: string | null;

  @Column({ length: 20, default: 'sandbox' })
  environment: 'sandbox' | 'production';

  @Column({ name: 'client_id', type: 'text', nullable: true })
  clientId: string | null;

  @Column({ name: 'client_secret', type: 'text', nullable: true })
  clientSecret: string | null;

  // PEM do certificado e da chave privada (mTLS) — armazenados criptografados como texto.
  @Column({ type: 'text', nullable: true })
  certificate: string | null;

  @Column({ name: 'private_key', type: 'text', nullable: true })
  privateKey: string | null;

  @Column({ name: 'pix_key', length: 200, nullable: true })
  pixKey: string | null;

  @Column({ length: 60, nullable: true })
  account: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
