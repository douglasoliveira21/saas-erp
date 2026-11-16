import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { todayInBrasilia } from '../../common/date';
import { BbCharge } from './entities/bb-charge.entity';
import { BbConfigService } from './bb-config.service';
import { BbConnection, BbHttpService } from './bb-http.service';
import { renderBbBoleto } from './bb-boleto-pdf';

export function bbDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T12:00:00Z')) ||
      new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) throw new BadRequestException('Data de vencimento inválida.');
  return value.split('-').reverse().join('.');
}

export function bbBoletoStatus(code: number): string {
  if ([6, 10, 11, 12].includes(code)) return 'PAGO';
  if (code === 7) return 'CANCELADO'; // Baixa no BB não significa pagamento.
  return 'A_RECEBER'; // Protesto e pagamento parcial nunca quitam a venda inteira.
}

@Injectable()
export class BancoBrasilService {
  constructor(
    public readonly config: BbConfigService,
    private readonly http: BbHttpService,
    @InjectRepository(BbCharge) private readonly charges: Repository<BbCharge>,
    private readonly source: DataSource,
    private readonly context: TenantContextService,
  ) {}

  async testConnection(kind: 'boleto' | 'pix') {
    const config = await this.config.resolve(undefined, true);
    // O teste apenas autentica os escopos; não cria cobrança nem movimenta dinheiro.
    const scopes = kind === 'boleto' ? ['cobrancas.boletos-info', 'cobrancas.boletos-requisicao'] : ['cob.read', 'cob.write'];
    for (const scope of scopes) await this.http.token(config, scope);
    return { success: true, message: `Autenticação de ${kind === 'boleto' ? 'boletos' : 'Pix'} aprovada em ${config.row.environment === 'production' ? 'produção' : 'testes'}. O convênio e a emissão ainda precisam ser homologados.` };
  }

  private async load(code: string, kind: 'boleto' | 'pix') {
    if (!/^bb:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(code)) throw new BadRequestException('Identificador de cobrança BB inválido.');
    const row = await this.charges.findOne({ where: { id: code.slice(3), tenantId: this.context.requireTenantId(), kind } });
    if (!row) throw new NotFoundException('Cobrança BB não encontrada nesta empresa.');
    return row;
  }

  private path(charge: BbCharge) {
    return (charge.kind === 'boleto' ? '/boletos/' : '/cob/') + encodeURIComponent(charge.externalId);
  }

  private async fetch(charge: BbCharge, config: BbConnection) {
    const response = await this.http.call(config, charge.kind as 'boleto' | 'pix', 'GET', this.path(charge), undefined,
      charge.kind === 'boleto' ? { numeroConvenio: String(config.row.settings.agreement) } : {});
    if (charge.kind === 'boleto' ? !Number.isInteger(response.codigoEstadoTituloCobranca) : !['ATIVA','CONCLUIDA','REMOVIDA_PELO_USUARIO_RECEBEDOR','REMOVIDA_PELO_PSP'].includes(response.status)) {
      throw new HttpException('O BB retornou uma consulta sem situação válida. O pagamento não foi confirmado; tente consultar novamente.', 502);
    }
    charge.response = { ...charge.response, ...response };
    if (charge.state !== 'cancelado') charge.state = 'emitido';
    await this.charges.save(charge);
    return this.normalize(charge);
  }

  private normalize(charge: BbCharge): any {
    const data = charge.response;
    const linhaDigitavel = data.codigoLinhaDigitavel || data.linhaDigitavel || '';
    const codigoSolicitacao = 'bb:' + charge.id;
    const pixCopiaECola = data.qrCode?.emv || data.pixCopiaECola || data.textoImagemQRcode || '';
    if (charge.kind === 'pix') return { ...data, status: charge.state === 'cancelado' && data.status !== 'CONCLUIDA' ? 'REMOVIDA_PELO_USUARIO_RECEBEDOR' : data.status,
      valorTotalRecebido: data.status === 'CONCLUIDA' ? (data.pix || []).reduce((sum: number, pix: any) => sum + Number(pix.valor || 0), 0) : undefined,
      txid: codigoSolicitacao, bbTxid: charge.externalId, codigoSolicitacao, pixCopiaECola };
    let situacao = bbBoletoStatus(Number(data.codigoEstadoTituloCobranca || 1));
    if (charge.state === 'cancelado' && situacao !== 'PAGO') situacao = 'CANCELADO';
    if (situacao === 'A_RECEBER' && charge.payload.dataVencimento.split('.').reverse().join('-') < todayInBrasilia()) situacao = 'VENCIDO';
    return {
      codigoSolicitacao, nossoNumero: charge.externalId, linhaDigitavel, pixCopiaECola,
      cobranca: { situacao, valorTotalRecebido: Number(data.valorPagoSacado || data.valorPago || 0) },
      boleto: { linhaDigitavel, nossoNumero: charge.externalId }, pix: { pixCopiaECola },
      bb: { codigoEstadoTituloCobranca: data.codigoEstadoTituloCobranca },
    };
  }

  private async reserveNumber(charge: BbCharge, config: BbConnection) {
    // Não adote um título antigo de outro emissor como se fosse desta venda.
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await this.http.call(config, 'boleto', 'GET', this.path(charge), undefined, { numeroConvenio: String(config.row.settings.agreement) });
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === 404) return;
        throw error;
      }
      const [next] = await this.source.query("SELECT nextval('bb_charge_number_seq')::text AS number");
      charge.externalId = '000' + config.row.settings.agreement + next.number.padStart(10, '0');
      charge.payload.numeroTituloCliente = charge.externalId;
      await this.charges.save(charge);
    }
    throw new ConflictException('A numeração deste convênio já está em uso no BB. Confira a sequência com o suporte antes de emitir.');
  }

  private async issue(kind: 'boleto' | 'pix', requestKey: string, build: (config: BbConnection, externalId: string) => any) {
    const tenantId = this.context.requireTenantId();
    if (!requestKey || requestKey.length > 200) throw new BadRequestException('Referência da cobrança inválida.');
    const runner = this.source.createQueryRunner();
    await runner.connect();
    const lockKey = `bb-charge:${tenantId}:${kind}:${requestKey}`;
    let locked = false;
    try {
      const [lock] = await runner.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lockKey]);
      locked = lock.locked;
      if (!locked) throw new ConflictException('Esta cobrança está sendo emitida. Aguarde e consulte novamente.');
      let charge = await this.charges.findOne({ where: { tenantId, kind, requestKey } });
      const config = await this.config.resolve(charge?.configId);
      if (!charge) {
        const [sequence] = await runner.query("SELECT nextval('bb_charge_number_seq')::text AS number");
        const agreement = String(config.row.settings.agreement || '');
        if (kind === 'boleto' && !/^\d{7}$/.test(agreement)) throw new BadRequestException('Cadastre o convênio BB com 7 dígitos. Outros tipos de convênio precisam de homologação específica.');
        const externalId = kind === 'boleto' ? '000' + agreement + sequence.number.padStart(10, '0')
          : createHash('sha256').update(`${tenantId}:${config.row.id}:${requestKey}`).digest('hex').slice(0, 32);
        const payload = build(config, externalId);
        charge = await this.charges.save(this.charges.create({ tenantId, configId: config.row.id, kind, requestKey, externalId, payload, response: {}, state: 'novo' }));
      } else {
        const payload = build(config, charge.externalId);
        // O dia da primeira emissão faz parte do registro, inclusive em tentativas no dia seguinte.
        if (kind === 'boleto') payload.dataEmissao = charge.payload.dataEmissao;
        if (charge.state === 'rejeitado') charge.payload = payload;
        if (JSON.stringify(payload) !== JSON.stringify(charge.payload)) throw new ConflictException('Já existe uma tentativa de emissão com esta referência e dados diferentes. Consulte ou cancele a cobrança anterior.');
        if (charge.state === 'cancelado') throw new ConflictException('Esta referência já foi cancelada. Use a reemissão da venda.');
        if (charge.state === 'emitido') return this.normalize(charge);
        // Uma queda de conexão pode ocorrer depois de o BB registrar. Consulte o MESMO número antes de reenviar.
        if (charge.state === 'enviando') {
          try { return await this.fetch(charge, config); }
          catch (error) { if (!(error instanceof HttpException) || error.getStatus() !== 404) throw error; }
        }
      }
      if (kind === 'boleto' && charge.state !== 'enviando') await this.reserveNumber(charge, config);
      charge.state = 'enviando';
      await this.charges.save(charge);
      try {
        charge.response = await this.http.call(config, kind, kind === 'boleto' ? 'POST' : 'PUT', kind === 'boleto' ? '/boletos' : this.path(charge), charge.payload);
        if (kind === 'boleto' ? !(charge.response.numero || charge.response.linhaDigitavel || charge.response.codigoLinhaDigitavel) : !charge.response.status) {
          throw new HttpException('O BB respondeu sem confirmar o registro. Consulte a mesma cobrança antes de emitir novamente.', 502);
        }
        charge.state = 'emitido';
        await this.charges.save(charge);
        return this.normalize(charge);
      } catch (error) {
        // Mesmo após rejeição, conserve a referência; não gere um novo nosso número automaticamente.
        if (error instanceof HttpException && [400, 422].includes(error.getStatus())) {
          charge.state = 'rejeitado';
          await this.charges.save(charge);
        }
        throw error;
      }
    } finally {
      try { if (locked) await runner.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockKey]); }
      finally { await runner.release(); }
    }
  }

  async createBoleto(data: any, requestKey?: string) {
    bbDate(data.dataVencimento);
    if (data.dataVencimento < todayInBrasilia()) throw new BadRequestException('O vencimento deve ser hoje ou uma data futura.');
    const doc = String(data.pagador?.cpfCnpj || '').replace(/\D/g, '');
    if (![11, 14].includes(doc.length) || !/^\d{8}$/.test(data.pagador?.cep || '')) throw new BadRequestException('Confira CPF/CNPJ e CEP do cliente antes de emitir o boleto BB.');
    if (!data.pagador.nome || !data.pagador.endereco || !data.pagador.cidade || !/^[A-Z]{2}$/.test(data.pagador.uf || '')) throw new BadRequestException('Preencha nome, endereço, cidade e UF do cliente.');
    if (!Number.isFinite(Number(data.valorNominal)) || Number(data.valorNominal) < 0.01) throw new BadRequestException('Valor do boleto inválido.');
    return this.issue('boleto', requestKey || data.seuNumero, (config, externalId) => {
      const s = config.row.settings;
      if (!s.wallet || s.variation === undefined || s.variation === '') throw new BadRequestException('Informe carteira e variação do convênio BB.');
      if (![1, 4].includes(Number(s.modality || 1))) throw new BadRequestException('Modalidade do convênio deve ser 1 ou 4.');
      return {
        numeroConvenio: Number(s.agreement), numeroCarteira: Number(s.wallet), numeroVariacaoCarteira: Number(s.variation), codigoModalidade: Number(s.modality || 1),
        dataEmissao: bbDate(todayInBrasilia()), dataVencimento: bbDate(data.dataVencimento), valorOriginal: Number(Number(data.valorNominal).toFixed(2)),
        codigoAceite: 'N', codigoTipoTitulo: 2, indicadorPermissaoRecebimentoParcial: 'N', indicadorAceiteTituloVencido: Number(data.numDiasAgenda || 0) > 0 ? 'S' : 'N',
        ...(Number(data.numDiasAgenda || 0) > 0 ? { numeroDiasLimiteRecebimento: Number(data.numDiasAgenda) } : {}),
        numeroTituloBeneficiario: requestKey ? createHash('sha256').update(requestKey).digest('hex').slice(0,15).toUpperCase()
          : String(data.seuNumero).replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 15), numeroTituloCliente: externalId,
        indicadorPix: s.bolepix === true ? 'S' : 'N', indicadorProtestar: 'N',
        ...(Number(data.mora?.taxa) > 0 ? { jurosMora: { tipo: 2, porcentagem: Number(data.mora.taxa) } } : {}),
        ...(Number(data.multa?.taxa) > 0 ? { multa: { tipo: 2, porcentagem: Number(data.multa.taxa), data: bbDate(new Date(Date.parse(data.dataVencimento + 'T12:00:00Z') + 86400000).toISOString().slice(0,10)) } } : {}),
        pagador: { tipoInscricao: doc.length === 11 ? 1 : 2, numeroInscricao: Number(doc), nome: data.pagador.nome.slice(0,60),
          endereco: data.pagador.endereco.slice(0,60), cep: Number(data.pagador.cep), cidade: data.pagador.cidade.slice(0,30), uf: data.pagador.uf,
          ...(data.pagador.bairro ? { bairro: data.pagador.bairro.slice(0,30) } : {}) },
      };
    });
  }

  async createPix(data: any, requestKey: string) {
    if (!/^\d+\.\d{2}$/.test(data.valor?.original || '') || Number(data.valor.original) <= 0) throw new BadRequestException('Valor do Pix inválido.');
    return this.issue('pix', requestKey, config => {
      if (!config.row.settings.pixKey) throw new BadRequestException('Cadastre a chave Pix da empresa no BB.');
      return { calendario: data.calendario || { expiracao: 3600 }, valor: data.valor, chave: config.row.settings.pixKey,
        solicitacaoPagador: String(data.solicitacaoPagador || '').slice(0,140), ...(data.infoAdicionais ? { infoAdicionais: data.infoAdicionais } : {}) };
    });
  }

  async get(code: string, kind: 'boleto' | 'pix', tenantId?: string | null): Promise<any> {
    if (tenantId !== undefined) {
      if (!tenantId) throw new BadRequestException('Empresa da cobrança não informada.');
      return this.context.run(tenantId, () => this.get(code, kind));
    }
    const charge = await this.load(code, kind);
    return this.fetch(charge, await this.config.resolve(charge.configId));
  }

  async cancel(code: string, kind: 'boleto' | 'pix') {
    const charge = await this.load(code, kind);
    const config = await this.config.resolve(charge.configId);
    const status = await this.fetch(charge, config);
    if ((kind === 'boleto' ? status.cobranca.situacao : status.status) === 'PAGO' || status.status === 'CONCLUIDA') throw new ConflictException('Cobrança paga não pode ser cancelada.');
    if (status.cobranca?.situacao !== 'CANCELADO' && !String(status.status || '').startsWith('REMOVIDA_')) {
      await this.http.call(config, kind, kind === 'boleto' ? 'POST' : 'PATCH', this.path(charge) + (kind === 'boleto' ? '/baixar' : ''),
        kind === 'boleto' ? { numeroConvenio: Number(config.row.settings.agreement) } : { status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' });
    }
    charge.state = 'cancelado';
    if (kind === 'pix') charge.response = { ...charge.response, status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' };
    else charge.response = { ...charge.response, codigoEstadoTituloCobranca: 7 };
    await this.charges.save(charge);
    return { success: true };
  }

  async pdf(code: string): Promise<Buffer> {
    const charge = await this.load(code, 'boleto');
    const config = await this.config.resolve(charge.configId);
    const status = await this.fetch(charge, config);
    if (status.cobranca.situacao === 'CANCELADO') throw new HttpException('Boleto cancelado. Baixe o boleto reemitido.', 410);
    return renderBbBoleto(charge, config.row.settings, config.row.environment);
  }
}
