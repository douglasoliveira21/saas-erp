import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import * as https from 'https';
import { BbConfigService } from './bb-config.service';

export type BbConnection = Awaited<ReturnType<BbConfigService['resolve']>>;

@Injectable()
export class BbHttpService {
  private readonly tokens = new Map<string, { token: string; expires: number }>();

  // Endereços fixos: uma credencial de tenant nunca pode redirecionar chamadas para outro host.
  private base(config: BbConnection, kind: 'boleto' | 'pix') {
    const production = config.row.environment === 'production';
    return kind === 'boleto'
      ? `https://api.${production ? '' : 'hm.'}bb.com.br/cobrancas/v2`
      : production ? 'https://api-pix.bb.com.br/pix/v2' : 'https://api.hm.bb.com.br/pix/v2';
  }

  private send(url: URL, method: string, config: BbConnection, body?: string, headers: Record<string, string> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method, cert: config.secrets.certificate || undefined, key: config.secrets.privateKey || undefined,
        rejectUnauthorized: true, minVersion: 'TLSv1.2',
        headers: { ...headers, ...(body ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}) },
      }, res => {
        const buffers: Buffer[] = []; let length = 0;
        res.on('data', chunk => {
          length += chunk.length;
          if (length > 2_000_000) req.destroy(new Error('Resposta excede o limite permitido'));
          else buffers.push(chunk);
        });
        res.on('error', () => reject(new HttpException('Conexão interrompida pelo Banco do Brasil. Consulte a cobrança antes de tentar novamente.', 503)));
        res.on('end', () => {
          let data: any;
          try { data = JSON.parse(Buffer.concat(buffers).toString() || '{}'); }
          catch { data = {}; }
          const status = res.statusCode || 502;
          if (status >= 200 && status < 300) return resolve(data);
          const messages = (data.erros || data.errors || []).map?.((item: any) => item.mensagem || item.message || item.descricao).filter(Boolean).join('; ');
          let detail = String(messages || data.error_description || data.detail || data.message || data.title || 'Solicitação recusada ou serviço indisponível').slice(0, 800);
          for (const field of ['clientId', 'clientSecret', 'appKey']) {
            if (config.secrets[field]) detail = detail.split(config.secrets[field]).join('[oculto]');
          }
          reject(new HttpException(`Banco do Brasil (${status}): ${detail}`, status >= 500 ? 503 : status));
        });
      });
      req.setTimeout(20_000, () => req.destroy(new Error('Tempo limite')));
      req.on('error', (err: any) => reject(new HttpException(
        /PEM|CERT|TLS|SSL|KEY/.test(err.code || '')
          ? 'Falha mTLS no Banco do Brasil. Confira o A1 da empresa e o cadastro da cadeia no Developers BB.'
          : 'Não foi possível concluir a comunicação com o Banco do Brasil. Consulte a cobrança antes de tentar novamente.', 503)));
      if (body) req.write(body);
      req.end();
    });
  }

  async token(config: BbConnection, scope: string): Promise<string> {
    if (scope.startsWith('cob.') && (!config.secrets.certificate || !config.secrets.privateKey)) {
      throw new BadRequestException('Cadastre o certificado A1 e a chave privada desta empresa para utilizar Pix do BB.');
    }
    const key = config.row.id + ':' + scope;
    const cached = this.tokens.get(key);
    if (cached && cached.expires > Date.now()) return cached.token;
    const url = new URL(`https://oauth.${config.row.environment === 'production' ? '' : 'hm.'}bb.com.br/oauth/token`);
    const response = await this.send(url, 'POST', config,
      new URLSearchParams({ grant_type: 'client_credentials', scope }).toString(), {
        Authorization: 'Basic ' + Buffer.from(config.secrets.clientId + ':' + config.secrets.clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      });
    if (!response.access_token) throw new HttpException('BB não retornou token de autenticação.', 502);
    if (this.tokens.size > 500) this.tokens.clear();
    this.tokens.set(key, { token: response.access_token, expires: Date.now() + Math.max(0, Number(response.expires_in || 300) - 30) * 1000 });
    return response.access_token;
  }

  async call(config: BbConnection, kind: 'boleto' | 'pix', method: string, path: string, body?: any, query: Record<string, string> = {}) {
    const scope = kind === 'boleto'
      ? method === 'GET' ? 'cobrancas.boletos-info' : 'cobrancas.boletos-requisicao'
      : method === 'GET' ? 'cob.read' : 'cob.write';
    const url = new URL(this.base(config, kind) + path);
    url.searchParams.set('gw-dev-app-key', config.secrets.appKey);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const token = await this.token(config, scope);
    try {
      return await this.send(url, method, config, body === undefined ? undefined : JSON.stringify(body), {
        Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      });
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 401) this.tokens.delete(config.row.id + ':' + scope);
      throw error;
    }
  }
}
