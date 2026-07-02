import { Controller, Get } from '@nestjs/common';
import * as https from 'https';

@Controller('market')
export class MarketController {
  private cache: any = null;
  private cacheTime = 0;

  @Get('quotes')
  async getQuotes() {
    // Cache de 3 minutos
    if (this.cache && Date.now() - this.cacheTime < 180000) {
      return this.cache;
    }

    const quotes: any = {};

    // Buscar cotações de moedas via AwesomeAPI
    try {
      const currencies = await this.httpGet('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL');
      const parsed = JSON.parse(currencies);
      if (parsed.USDBRL) quotes.USD = { value: Number(parsed.USDBRL.bid).toFixed(2), change: Number(parsed.USDBRL.pctChange) };
      if (parsed.EURBRL) quotes.EUR = { value: Number(parsed.EURBRL.bid).toFixed(2), change: Number(parsed.EURBRL.pctChange) };
      if (parsed.BTCBRL) quotes.BTC = { value: Number(parsed.BTCBRL.bid), change: Number(parsed.BTCBRL.pctChange) };
      if (parsed.GBPBRL) quotes.GBP = { value: Number(parsed.GBPBRL.bid).toFixed(2), change: Number(parsed.GBPBRL.pctChange) };
    } catch {}

    // Buscar Selic, IPCA, IGP-M via BCB
    try {
      const selic = await this.httpGet('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json');
      const selicData = JSON.parse(selic);
      if (selicData?.[0]) quotes.SELIC = { value: Number(selicData[0].valor).toFixed(2) };
    } catch {}

    try {
      const ipca = await this.httpGet('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json');
      const ipcaData = JSON.parse(ipca);
      if (ipcaData?.[0]) quotes.IPCA = { value: ipcaData[0].valor };
    } catch {}

    try {
      const igpm = await this.httpGet('https://api.bcb.gov.br/dados/serie/bcdata.sgs.189/dados/ultimos/1?formato=json');
      const igpmData = JSON.parse(igpm);
      if (igpmData?.[0]) quotes.IGPM = { value: igpmData[0].valor };
    } catch {}

    // Buscar índices via brapi.dev (server-side não tem CORS)
    try {
      const brapi = await this.httpGet('https://brapi.dev/api/quote/%5EBVSP,%5EGSPC,%5EIXIC?range=1d&interval=1d');
      const brapiData = JSON.parse(brapi);
      if (brapiData?.results) {
        for (const r of brapiData.results) {
          const price = r.regularMarketPrice || 0;
          const pct = r.regularMarketChangePercent || 0;
          if (r.symbol === '^BVSP') quotes.IBOV = { value: price, change: pct };
          if (r.symbol === '^GSPC') quotes.SP500 = { value: price, change: pct };
          if (r.symbol === '^IXIC') quotes.NASDAQ = { value: price, change: pct };
        }
      }
    } catch {}

    // Tentar IFIX
    try {
      const ifix = await this.httpGet('https://brapi.dev/api/quote/IFIX?range=1d&interval=1d');
      const ifixData = JSON.parse(ifix);
      if (ifixData?.results?.[0]) {
        quotes.IFIX = { value: ifixData.results[0].regularMarketPrice, change: ifixData.results[0].regularMarketChangePercent || 0 };
      }
    } catch {}

    this.cache = quotes;
    this.cacheTime = Date.now();
    return quotes;
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        timeout: 8000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) resolve(body);
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }
}
