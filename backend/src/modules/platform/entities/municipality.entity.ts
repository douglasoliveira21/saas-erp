import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Catálogo de plataforma (não pertence a nenhum tenant) — lista quais municípios já têm
// provedor de NFS-e mapeado, para a tela de configuração fiscal de cada tenant poder
// autopreencher a URL da API e avisar se aquela prefeitura ainda não foi homologada.
@Entity('municipalities')
export class Municipality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 2 })
  uf: string;

  @Column({ name: 'ibge_code', length: 7, unique: true })
  ibgeCode: string;

  @Column({ length: 60, nullable: true })
  provider: string | null;

  @Column({ name: 'nfse_api_url', length: 500, nullable: true })
  nfseApiUrl: string | null;

  @Column({ name: 'nfse_test_url', length: 500, nullable: true })
  nfseTestUrl: string | null;

  @Column({ length: 20, default: 'nao_suportado' })
  status: 'suportado' | 'em_teste' | 'nao_suportado';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
