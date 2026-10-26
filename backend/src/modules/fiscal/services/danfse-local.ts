import PDFDocument = require('pdfkit');

// DANFSe gerado pelo proprio sistema a partir do XML autorizado da NFS-e Nacional. Serve de plano B quando o
// portal nacional nao entrega o PDF oficial (o endereco /danfse responde 404 em alguns ambientes).

const PAGE_WIDTH = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim() : '';
}

const money = (value: string) => 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function doc(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value;
}

function dateTime(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
}

function logoBuffer(value?: string): Buffer | null {
  const m = (value || '').match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  return m ? Buffer.from(m[2].replace(/\s/g, ''), 'base64') : null;
}

export function renderDanfseFromXml(xmlAuthorized: string, accessKey: string, companyLogo?: string): Promise<Buffer> {
  const xml = xmlAuthorized;
  const dpsStart = xml.search(/<DPS[\s>]/);
  const nfse = dpsStart > 0 ? xml.slice(0, dpsStart) : xml;
  const dps = dpsStart > 0 ? xml.slice(dpsStart) : xml;
  const emit = tag(nfse, 'emit');
  const toma = tag(dps, 'toma');
  const valores = tag(nfse, 'valores');
  const homologacao = (tag(dps, 'tpAmb') || tag(nfse, 'ambGer')) === '2';

  const emitAddress = [tag(emit, 'xLgr'), tag(emit, 'nro'), tag(emit, 'xBairro')].filter(Boolean).join(', ');
  const emitCity = [tag(nfse, 'xLocEmi'), tag(emit, 'UFEmit') || tag(emit, 'UF')].filter(Boolean).join(' - ');
  const tomaAddress = [tag(toma, 'xLgr'), tag(toma, 'nro'), tag(toma, 'xBairro')].filter(Boolean).join(', ');

  const fields = {
    number: tag(nfse, 'nNFSe'),
    series: tag(dps, 'serie'),
    competence: tag(dps, 'dCompet'),
    issuedAt: tag(nfse, 'dhProc') || tag(dps, 'dhEmi'),
    emitName: tag(emit, 'xNome'),
    emitDoc: tag(emit, 'CNPJ') || tag(emit, 'CPF'),
    emitIm: tag(emit, 'IM'),
    emitCep: tag(emit, 'CEP'),
    tomaName: tag(toma, 'xNome'),
    tomaDoc: tag(toma, 'CNPJ') || tag(toma, 'CPF'),
    tomaEmail: tag(toma, 'email'),
    serviceCode: tag(dps, 'cTribNac'),
    serviceCodeName: tag(nfse, 'xTribNac'),
    description: tag(dps, 'xDescServ'),
    incidence: tag(nfse, 'xLocIncid') || tag(nfse, 'xLocPrestacao'),
    serviceValue: tag(tag(dps, 'vServPrest'), 'vServ') || tag(dps, 'vServ'),
    base: tag(valores, 'vBC'),
    rate: tag(valores, 'pAliqAplic') || tag(dps, 'pAliq'),
    issValue: tag(valores, 'vISSQN'),
    net: tag(valores, 'vLiq'),
  };

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const section = (title: string) => {
      pdf.moveDown(0.6);
      const y = pdf.y;
      pdf.rect(MARGIN, y, CONTENT_WIDTH, 16).fill('#e5e7eb');
      pdf.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(title.toUpperCase(), MARGIN + 6, y + 4, { width: CONTENT_WIDTH - 12 });
      pdf.y = y + 22;
    };
    const line = (label: string, value: string) => {
      if (!value) return;
      pdf.font('Helvetica-Bold').fontSize(8.5).fillColor('#374151').text(label + ': ', { continued: true })
        .font('Helvetica').fillColor('#111827').text(value, { width: CONTENT_WIDTH });
    };

    // Cabecalho
    const logo = logoBuffer(companyLogo);
    const top = pdf.y;
    if (logo) { try { pdf.image(logo, MARGIN, top, { fit: [100, 40] }); } catch { /* logo invalida: segue sem */ } }
    pdf.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text('DANFSe', MARGIN + 110, top, { width: CONTENT_WIDTH - 110, align: 'right' });
    pdf.font('Helvetica').fontSize(9).fillColor('#374151').text('Documento Auxiliar da Nota Fiscal de Serviço Eletrônica', MARGIN + 110, top + 17, { width: CONTENT_WIDTH - 110, align: 'right' });
    pdf.y = top + 48;

    if (homologacao) {
      pdf.font('Helvetica-Bold').fontSize(10).fillColor('#b91c1c').text('AMBIENTE DE HOMOLOGAÇÃO - SEM VALIDADE FISCAL', MARGIN, pdf.y, { width: CONTENT_WIDTH, align: 'center' });
    }

    section('Identificação da NFS-e');
    line('Número da NFS-e', fields.number);
    line('Série da DPS', fields.series);
    line('Competência', fields.competence ? dateTime(fields.competence) : '');
    line('Emissão', fields.issuedAt ? dateTime(fields.issuedAt) : '');
    line('Chave de acesso', accessKey);

    section('Prestador do serviço');
    line('Nome / Razão social', fields.emitName);
    line('CNPJ', fields.emitDoc ? doc(fields.emitDoc) : '');
    line('Inscrição municipal', fields.emitIm);
    line('Endereço', [emitAddress, emitCity, fields.emitCep].filter(Boolean).join(' - '));

    section('Tomador do serviço');
    line('Nome / Razão social', fields.tomaName);
    line('CPF/CNPJ', fields.tomaDoc ? doc(fields.tomaDoc) : '');
    line('Endereço', tomaAddress);
    line('E-mail', fields.tomaEmail);

    section('Serviço prestado');
    line('Código de tributação nacional', [fields.serviceCode, fields.serviceCodeName].filter(Boolean).join(' - '));
    line('Local de incidência', fields.incidence);
    pdf.moveDown(0.3);
    pdf.font('Helvetica-Bold').fontSize(8.5).fillColor('#374151').text('Descrição:');
    pdf.font('Helvetica').fontSize(9).fillColor('#111827').text(fields.description || '-', { width: CONTENT_WIDTH });

    section('Valores');
    line('Valor do serviço', fields.serviceValue ? money(fields.serviceValue) : '');
    line('Base de cálculo do ISSQN', fields.base ? money(fields.base) : '');
    line('Alíquota aplicada', fields.rate ? Number(fields.rate).toFixed(2) + '%' : '');
    line('Valor do ISSQN', fields.issValue ? money(fields.issValue) : '');
    line('Valor líquido', fields.net ? money(fields.net) : '');

    pdf.moveDown(1.2);
    pdf.font('Helvetica').fontSize(7.5).fillColor('#6b7280').text('Documento gerado pelo sistema a partir do XML autorizado no Emissor Nacional de NFS-e. A consulta oficial pode ser feita no portal nacional com a chave de acesso.', MARGIN, pdf.y, { width: CONTENT_WIDTH, align: 'center' });
    pdf.end();
  });
}
