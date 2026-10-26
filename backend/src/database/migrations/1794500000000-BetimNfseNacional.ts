import { MigrationInterface, QueryRunner } from 'typeorm';

// Betim/MG emite pelo Emissor Nacional de NFS-e (SEFIN Nacional, mTLS com o A1 do tenant). A
// integracao existe, mas ainda nao foi validada em homologacao com um certificado real - por isso
// entra como 'em_teste'. As URLs ficam vazias: o servico usa os enderecos padrao da SEFIN Nacional
// e o super admin pode sobrescreve-las no catalogo sem novo deploy.
export class BetimNfseNacional1794500000000 implements MigrationInterface {
  name = 'BetimNfseNacional1794500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE municipalities
      SET status = 'em_teste',
          notes = 'Emissor Nacional de NFS-e (obrigatório desde 01/01/2026): emissão direta na SEFIN Nacional com o certificado A1 do tenant. Validar em homologação (ambiente 2) antes de usar em produção.'
      WHERE ibge_code = '3106705' AND provider = 'nfse_nacional' AND status = 'nao_suportado'
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE municipalities SET status = 'nao_suportado' WHERE ibge_code = '3106705' AND status = 'em_teste'`);
  }
}
