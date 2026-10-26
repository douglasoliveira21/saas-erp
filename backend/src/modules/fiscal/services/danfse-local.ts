import PDFDocument = require('pdfkit');
import bwipjs = require('bwip-js');

// DANFSe (v2.0) gerado pelo proprio sistema a partir do XML autorizado da NFS-e Nacional, no mesmo desenho do
// documento oficial do portal (moldura unica, blocos com titulo cinza e rotulos pequenos acima dos valores).
// Serve de plano B quando o portal nao entrega o PDF oficial (o endereco /danfse responde 404 em alguns ambientes).

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const FRAME = 16;
const W = PAGE_W - FRAME * 2;
const COL_W = W / 4;
const PAD = 5;

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim() : '';
}

const dash = (value?: string | null) => (value && String(value).trim() ? String(value).trim() : '-');
const money = (value: string) => (value === '' ? '-' : 'R$ ' + Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const percent = (value: string) => (value === '' ? '-' : Number(value).toFixed(2).replace('.', ',') + '%');

function docNumber(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value || '-';
}

function dateOnly(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : dash(iso);
}

function dateTime(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : dateOnly(iso);
}

function ibge(value: string): string {
  return /^\d{7}$/.test(value) ? value.replace(/^(\d{2})(\d{5})$/, '$1.$2').replace(/^(\d{2})\.(\d{5})$/, '$1.$2') : dash(value);
}

function cep(value: string): string {
  const d = value.replace(/\D/g, '');
  return d.length === 8 ? d.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : dash(value);
}

function serviceCode(value: string): string {
  const d = value.replace(/\D/g, '');
  return d.length === 6 ? d.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3') : dash(value);
}

function logoBuffer(value?: string): Buffer | null {
  const m = (value || '').match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  return m ? Buffer.from(m[2].replace(/\s/g, ''), 'base64') : null;
}

const SIMPLES_REGIME: Record<string, string> = {
  '1': 'Não Optante',
  '2': 'Optante - Microempreendedor Individual (MEI)',
  '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)',
};

const SIMPLES_APURACAO: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  '2': 'Regime de apuração dos tributos federais pelo Simples Nacional e municipal pela NFS-e',
  '3': 'Regime de apuração dos tributos federais e municipal pela NFS-e',
};

export async function renderDanfseFromXml(xmlAuthorized: string, accessKey: string, companyLogo?: string): Promise<Buffer> {
  const xml = xmlAuthorized;
  const dpsStart = xml.search(/<DPS[\s>]/);
  const nfse = dpsStart > 0 ? xml.slice(0, dpsStart) : xml;
  const dps = dpsStart > 0 ? xml.slice(dpsStart) : xml;
  const emit = tag(nfse, 'emit');
  const emitEnd = tag(emit, 'enderNac') || emit;
  const toma = tag(dps, 'toma');
  const valores = tag(nfse, 'valores');
  const tribMun = tag(dps, 'tribMun');
  const tpAmb = tag(dps, 'tpAmb') || '2';
  const regTrib = tag(dps, 'regTrib');

  const join = (...parts: string[]) => parts.filter(Boolean).join(', ');
  const emitAddress = join(tag(emitEnd, 'xLgr'), tag(emitEnd, 'nro'), tag(emitEnd, 'xCpl'), tag(emitEnd, 'xBairro'));
  const tomaAddress = join(tag(toma, 'xLgr'), tag(toma, 'nro'), tag(toma, 'xCpl'), tag(toma, 'xBairro'));
  const retention = tag(tribMun, 'tpRetISSQN');
  const issRate = tag(valores, 'pAliqAplic') || tag(tribMun, 'pAliq');
  const serviceValue = tag(tag(dps, 'vServPrest'), 'vServ') || tag(dps, 'vServ');
  const net = tag(valores, 'vLiq') || serviceValue;
  const issValue = tag(valores, 'vISSQN');
  const incidenceCity = tag(nfse, 'xLocIncid') || tag(nfse, 'xLocPrestacao') || tag(nfse, 'xLocEmi');
  const emitCity = tag(nfse, 'xLocEmi');
  const emitUf = tag(emitEnd, 'UF');
  const infComp = tag(dps, 'xInfComp');
  const consultUrl = (tpAmb === '1' ? 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=' : 'https://www.producaorestrita.nfse.gov.br/ConsultaPublica/?tpc=1&chave=') + accessKey;
  const qr = await bwipjs.toBuffer({ bcid: 'qrcode', text: consultUrl, scale: 3, eclevel: 'M' } as any).catch(() => null);
  const logo = logoBuffer(companyLogo);

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    let y = FRAME;
    const x0 = FRAME;
    const hline = (at: number, width = 0.6) => pdf.lineWidth(width).strokeColor('#000000').moveTo(x0, at).lineTo(x0 + W, at).stroke();

    // rotulo pequeno em negrito + valor; devolve a altura usada
    const cell = (col: number, span: number, top: number, label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
      const x = x0 + col * COL_W + PAD;
      const width = COL_W * span - PAD * 2;
      pdf.font('Helvetica-Bold').fontSize(6.3).fillColor('#000000').text(label, x, top + 3, { width, lineBreak: false });
      pdf.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 8).fillColor('#000000');
      const h = pdf.heightOfString(value, { width });
      pdf.text(value, x, top + 11, { width });
      return 11 + h + 3;
    };
    const titleCell = (top: number, height: number, title: string) => {
      pdf.rect(x0, top, COL_W, height).fill('#eeeeee');
      pdf.font('Helvetica-Bold').fontSize(7.4).fillColor('#000000').text(title, x0 + PAD, top + 6, { width: COL_W - PAD * 2 });
    };
    // linha de campos; first=true reserva a 1a coluna para o titulo do bloco
    const rowBlock = (top: number, cells: Array<[number, number, string, string]>, minH = 24) => {
      let h = minH;
      for (const [col, span, label, value] of cells) h = Math.max(h, cell(col, span, top, label, value));
      return h;
    };

    // ===== Cabecalho =====
    const headerTop = y;
    if (logo) { try { pdf.image(logo, x0 + 6, headerTop + 6, { fit: [120, 48] }); } catch { /* logo invalida */ } }
    else {
      pdf.font('Helvetica-Bold').fontSize(20).fillColor('#1a7a3a').text('NFS', x0 + 8, headerTop + 8, { continued: true }).fillColor('#1d4f91').text('e');
      pdf.font('Helvetica').fontSize(6.5).fillColor('#555555').text('Nota Fiscal de Serviço eletrônica', x0 + 8, headerTop + 32, { width: 110 });
    }
    pdf.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('DANFSe v2.0', x0 + COL_W * 0.6, headerTop + 8, { width: COL_W * 2.4, align: 'center' });
    pdf.font('Helvetica-Bold').fontSize(9).text('Documento Auxiliar da NFS-e', x0 + COL_W * 0.6, headerTop + 22, { width: COL_W * 2.4, align: 'center' });
    pdf.font('Helvetica').fontSize(8).text('Município: ' + dash(emitCity) + (emitUf ? ' - ' + emitUf : ''), x0 + COL_W * 3 + PAD, headerTop + 6, { width: COL_W - PAD * 2 });
    pdf.font('Helvetica').fontSize(6.5).text('Ambiente Gerador: ' + dash(tag(nfse, 'ambGer')), x0 + COL_W * 3 + PAD, headerTop + 17, { width: COL_W - PAD * 2 });
    pdf.text('Tipo de Ambiente: ' + (tpAmb === '1' ? '1' : '2'), x0 + COL_W * 3 + PAD, headerTop + 25, { width: COL_W - PAD * 2 });
    y = headerTop + 52;
    hline(y);

    // ===== Chave + numeracao (a direita fica o QR Code) =====
    const blockTop = y;
    y += cell(0, 3, y, 'CHAVE DE ACESSO DA NFS-e', accessKey, { size: 8.5 }) + 1;
    let h = rowBlock(y, [
      [0, 1, 'NÚMERO DA NFS-e', dash(tag(nfse, 'nNFSe'))],
      [1, 1, 'COMPETÊNCIA DA NFS-e', dateOnly(tag(dps, 'dCompet'))],
      [2, 1, 'DATA E HORA DA EMISSÃO DA NFS-e', dateTime(tag(nfse, 'dhProc') || tag(dps, 'dhEmi'))],
    ]); y += h;
    h = rowBlock(y, [
      [0, 1, 'NÚMERO DA DPS', dash(tag(dps, 'nDPS'))],
      [1, 1, 'SÉRIE DA DPS', dash(tag(dps, 'serie'))],
      [2, 1, 'DATA E HORA DA EMISSÃO DA DPS', dateTime(tag(dps, 'dhEmi'))],
    ]); y += h;
    if (qr) { try { pdf.image(qr, x0 + COL_W * 3 + 38, blockTop + 4, { fit: [64, 64] }); } catch { /* sem QR */ } }
    pdf.font('Helvetica').fontSize(5.6).fillColor('#000000').text('A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e', x0 + COL_W * 3 + PAD, blockTop + 70, { width: COL_W - PAD * 2 });
    y = Math.max(y, blockTop + 96);

    h = rowBlock(y, [
      [0, 1, 'EMITENTE DA NFS-e', 'Prestador'],
      [1, 1, 'SITUAÇÃO DA NFS-e', 'NFS-e Gerada'],
      [2, 1, 'FINALIDADE', '-'],
    ], 26);
    pdf.rect(x0, y, COL_W, h).fill('#eeeeee'); // faixa cinza do "emitente"
    cell(0, 1, y, 'EMITENTE DA NFS-e', 'Prestador'); y += h;
    hline(y);

    // ===== Prestador =====
    const prestTop = y;
    const prestH = 98;
    titleCell(prestTop, prestH, 'PRESTADOR / FORNECEDOR');
    cell(1, 1, prestTop, 'CNPJ / CPF / NIF', docNumber(tag(emit, 'CNPJ') || tag(emit, 'CPF')));
    cell(2, 1, prestTop, 'Indicador Municipal (Inscrição)', dash(tag(emit, 'IM')));
    cell(3, 1, prestTop, 'Telefone', dash(tag(emit, 'fone')));
    cell(0, 3, prestTop + 24, 'Nome / Nome Empresarial', dash(tag(emit, 'xNome')));
    cell(2, 1, prestTop + 24, 'Município / Sigla UF', dash(join(emitCity, emitUf).replace(', ', ' / ')));
    cell(3, 1, prestTop + 24, 'Código IBGE / CEP', ibge(tag(emitEnd, 'cMun')) + ' / ' + cep(tag(emitEnd, 'CEP')));
    cell(0, 3, prestTop + 48, 'Endereço', dash(emitAddress));
    cell(3, 1, prestTop + 48, 'E-mail', dash(tag(emit, 'email')));
    cell(0, 2, prestTop + 72, 'Simples Nacional na Data de Competência', SIMPLES_REGIME[tag(regTrib, 'opSimpNac')] || '-');
    cell(2, 2, prestTop + 72, 'Regime de Apuração Tributária pelo SN', SIMPLES_APURACAO[tag(regTrib, 'regApTribSN')] || '-');
    y = prestTop + prestH; hline(y);

    // ===== Tomador =====
    const tomaTop = y;
    const tomaH = 72;
    titleCell(tomaTop, tomaH, 'TOMADOR / ADQUIRENTE');
    cell(1, 1, tomaTop, 'CNPJ / CPF / NIF', docNumber(tag(toma, 'CNPJ') || tag(toma, 'CPF')));
    cell(2, 1, tomaTop, 'Indicador Municipal (Inscrição)', dash(tag(toma, 'IM')));
    cell(3, 1, tomaTop, 'Telefone', dash(tag(toma, 'fone')));
    cell(0, 3, tomaTop + 24, 'Nome / Nome Empresarial', dash(tag(toma, 'xNome')));
    cell(2, 1, tomaTop + 24, 'Município / Sigla UF', '-');
    cell(3, 1, tomaTop + 24, 'Código IBGE / CEP', ibge(tag(toma, 'cMun')) + ' / ' + cep(tag(toma, 'CEP')));
    cell(0, 3, tomaTop + 48, 'Endereço', dash(tomaAddress));
    cell(3, 1, tomaTop + 48, 'E-mail', dash(tag(toma, 'email')));
    y = tomaTop + tomaH; hline(y);

    pdf.font('Helvetica').fontSize(8).fillColor('#000000').text('DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', x0, y + 3, { width: W, align: 'center' });
    y += 14; hline(y, 0.4);
    pdf.text('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e', x0, y + 3, { width: W, align: 'center' });
    y += 14; hline(y);

    // ===== Servico =====
    const servTop = y;
    titleCell(servTop, 26, 'SERVIÇO PRESTADO');
    cell(1, 1, servTop, 'Código de Tributação Nacional/Municipal', serviceCode(tag(dps, 'cTribNac')) + ' / -');
    cell(2, 1, servTop, 'Código da NBS', dash(tag(dps, 'cNBS') || tag(nfse, 'xNBS')));
    cell(3, 1, servTop, 'Local da Prestação / Sigla UF / País', dash(tag(nfse, 'xLocPrestacao') || incidenceCity) + (emitUf ? ' / ' + emitUf : '') + ' / -');
    y = servTop + 28;
    pdf.font('Helvetica').fontSize(8).fillColor('#000000').text(dash(tag(nfse, 'xTribNac')), x0 + PAD, y, { width: W - PAD * 2, height: 10, ellipsis: true });
    y += 14;
    const description = dash(tag(dps, 'xDescServ'));
    const descH = Math.max(24, 11 + pdf.heightOfString(description, { width: W - PAD * 2 }) + 6);
    cell(0, 4, y, 'Descrição do Serviço', description);
    y += descH; hline(y);

    // ===== Tributacao municipal =====
    const section = (title: string, rows: Array<Array<[number, number, string, string]>>, titleRow = 0) => {
      const top = y;
      const height = rows.length * 24 + 2;
      titleCell(top, 24, title);
      rows.forEach((cells, i) => { for (const [col, span, label, value] of cells) cell(col, span, top + i * 24, label, value); });
      y = top + height; hline(y);
    };
    section('TRIBUTAÇÃO MUNICIPAL (ISSQN)', [
      [[1, 1, 'Tipo de Tributação do ISSQN', tag(tribMun, 'tribISSQN') === '1' || !tag(tribMun, 'tribISSQN') ? 'Operação Tributável' : '-'],
       [2, 2, 'Município / Sigla UF / País de Incidência do ISSQN', dash(incidenceCity) + (emitUf ? ' / ' + emitUf : '') + ' / -']],
      [[0, 1, 'BC ISSQN', issValue || issRate ? money(tag(valores, 'vBC')) : '-'],
       [1, 1, 'Alíquota Aplicada', issRate ? percent(issRate) : '-'],
       [2, 1, 'Retenção do ISSQN', retention === '2' ? 'Retido pelo Tomador' : retention === '3' ? 'Retido pelo Intermediário' : 'Não Retido'],
       [3, 1, 'ISSQN Apurado', issValue ? money(issValue) : '-']],
    ]);
    section('TRIBUTAÇÃO FEDERAL (EXCETO CBS)', [
      [[1, 1, 'IRRF', '-'], [2, 1, 'Contribuição Previdenciária - Retida', '-'], [3, 1, 'Contribuições Sociais - Retidas', '-']],
      [[0, 1, 'PIS - Débito Apuração Própria', '-'], [1, 1, 'COFINS - Débito Apuração Própria', '-'], [2, 2, 'Descrição Contrib. Sociais - Retidas', '-']],
    ]);
    section('TRIBUTAÇÃO IBS/CBS', [
      [[1, 1, 'CST / cClassTrib', '- / -'], [2, 2, 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', '- / - / - / -']],
      [[0, 1, 'Exclusões e Reduções da Base de Cálculo', 'R$ 0,00'], [1, 1, 'Base de Cálculo Após Exclusões e Reduções', '-'], [2, 1, 'Red. Alíquota IBS / Red. Alíquota CBS', '- / - / -'], [3, 1, 'Alíquota - IBS UF / IBS Mun', '- / -']],
      [[0, 1, 'Alíq. Efetiva Municipal - IBS', '-'], [1, 1, 'Valor Apurado Municipal - IBS', '-'], [2, 1, 'Alíq. Efetiva Estadual - IBS', '-'], [3, 1, 'Valor Apurado Estadual - IBS', '-']],
      [[0, 1, 'Valor Total Apurado - IBS', '-'], [1, 1, 'Alíquota - CBS', '-'], [2, 1, 'Alíquota Efetiva - CBS', '-'], [3, 1, 'Valor Total Apurado - CBS', '-']],
    ]);
    section('VALOR TOTAL DA NFS-e', [
      [[1, 1, 'VALOR DA OPERAÇÃO / SERVIÇO', money(serviceValue)], [2, 1, 'Desconto Incondicionado', '-'], [3, 1, 'Desconto Condicionado', '-']],
      [[0, 1, 'Total das Retenções (ISSQN / Federais)', tag(valores, 'vTotalRet') ? money(tag(valores, 'vTotalRet')) : '-'], [1, 1, 'VALOR LÍQUIDO DA NFS-e', money(net)], [2, 1, 'Total do IBS/CBS', 'R$ 0,00'], [3, 1, 'VALOR LÍQUIDO DA NFS-e + IBS/CBS', 'R$ 0,00']],
    ]);

    // ===== Informacoes complementares =====
    pdf.font('Helvetica-Bold').fontSize(8.2).fillColor('#000000').text('INFORMAÇÕES COMPLEMENTARES', x0 + PAD, y + 5, { width: W - PAD * 2 });
    y += 22;
    const extra = (infComp ? infComp + '\n' : '') + 'Totais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: -; Estaduais: -; Municipais: -;';
    pdf.font('Helvetica').fontSize(7.8).text(extra, x0 + PAD, y, { width: W - PAD * 2 });

    // ===== Rodape =====
    const footTop = PAGE_H - FRAME - 34;
    const footH = 24;
    pdf.lineWidth(0.6).rect(x0 + 6, footTop, W - 12, footH).stroke();
    pdf.moveTo(x0 + 6 + (W - 12) * 0.25, footTop).lineTo(x0 + 6 + (W - 12) * 0.25, footTop + footH).stroke();
    pdf.moveTo(x0 + 6 + (W - 12) * 0.5, footTop).lineTo(x0 + 6 + (W - 12) * 0.5, footTop + footH).stroke();
    const footCell = (col: number, label: string, value: string) => {
      const x = x0 + 6 + col * (W - 12) * 0.25 + 4;
      pdf.font('Helvetica-Bold').fontSize(6).text(label, x, footTop + 3, { width: (W - 12) * 0.25, lineBreak: false });
      if (value) pdf.font('Helvetica').fontSize(6.6).text(value, x, footTop + 12, { width: (W - 12) * 0.5 - 8, lineBreak: false });
    };
    footCell(0, 'DATA CIENTIFICAÇÃO:', '');
    footCell(1, 'IDENTIFICAÇÃO E ASSINATURA', '');
    footCell(2, 'Nº NFS-e / CHAVE NFS-e', dash(tag(nfse, 'nNFSe')) + ' / ' + accessKey);

    if (tpAmb !== '1') {
      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#b91c1c').text('AMBIENTE DE HOMOLOGAÇÃO - SEM VALIDADE FISCAL', x0, footTop - 16, { width: W, align: 'center' });
    }
    pdf.lineWidth(0.8).strokeColor('#000000').rect(x0, FRAME, W, PAGE_H - FRAME * 2).stroke();
    pdf.end();
  });
}
