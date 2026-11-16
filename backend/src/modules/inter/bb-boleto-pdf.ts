import { BadRequestException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import bwipjs = require('bwip-js');
import { BbCharge } from './entities/bb-charge.entity';

export function bbBarcode(response: Record<string, any>): { barcode: string; line: string } {
  const line = String(response.codigoLinhaDigitavel || response.linhaDigitavel || '').replace(/\D/g, '');
  const barcode = String(response.textoCodigoBarrasTituloCobranca || response.codigoBarraNumerico || '').replace(/\D/g, '') ||
    (line.length === 47 ? line.slice(0,4) + line[32] + line.slice(33) + line.slice(4,9) + line.slice(10,20) + line.slice(21,31) : '');
  if (line.length !== 47 || barcode.length !== 44 || !barcode.startsWith('0019')) throw new BadRequestException('BB ainda não retornou linha digitável e código de barras válidos para este boleto. Consulte novamente.');
  if (line.slice(0,4) + line[32] + line.slice(33) + line.slice(4,9) + line.slice(10,20) + line.slice(21,31) !== barcode) throw new BadRequestException('Linha digitável e código de barras do BB não conferem.');
  const mod10 = (digits: string) => {
    let sum = 0; let weight = 2;
    for (let i = digits.length - 1; i >= 0; i--) { const product = Number(digits[i]) * weight; sum += Math.floor(product / 10) + product % 10; weight = weight === 2 ? 1 : 2; }
    return String((10 - sum % 10) % 10);
  };
  let sum = 0; let weight = 2;
  for (let i = 43; i >= 0; i--) { if (i === 4) continue; sum += Number(barcode[i]) * weight; weight = weight === 9 ? 2 : weight + 1; }
  const raw = 11 - sum % 11;
  const general = [0,10,11].includes(raw) ? '1' : String(raw);
  if (mod10(line.slice(0,9)) !== line[9] || mod10(line.slice(10,20)) !== line[20] || mod10(line.slice(21,31)) !== line[31] || general !== barcode[4]) {
    throw new BadRequestException('Dígitos verificadores do boleto BB inválidos. Consulte o registro no banco.');
  }
  return { barcode, line };
}

export async function renderBbBoleto(charge: BbCharge, settings: Record<string, any>, environment: string): Promise<Buffer> {
  const { barcode, line } = bbBarcode(charge.response);
  if (!settings.beneficiaryName || !settings.beneficiaryDocument || !settings.agency || !settings.account) throw new BadRequestException('Preencha beneficiário, CPF/CNPJ, agência e conta na configuração do BB antes de baixar o PDF.');
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
  });
  const p: Record<string, any> = { ...charge.payload,
    dataVencimento: charge.response.dataVencimentoTituloCobranca || charge.payload.dataVencimento,
    valorOriginal: charge.response.valorOriginalTituloCobranca ?? charge.payload.valorOriginal,
  };
  if (Math.round(Number(p.valorOriginal) * 100) !== Number(barcode.slice(9,19))) throw new BadRequestException('O valor informado pelo BB não confere com o código de barras. Consulte o banco antes de enviar o boleto.');
  const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatted = `${line.slice(0,5)}.${line.slice(5,10)} ${line.slice(10,15)}.${line.slice(15,21)} ${line.slice(21,26)}.${line.slice(26,32)} ${line[32]} ${line.slice(33)}`;
  function field(label: string, value: string, x: number, y: number, w: number, h = 38) {
    doc.lineWidth(0.5).rect(x,y,w,h).stroke();
    doc.font('Helvetica').fontSize(7).text(label,x+5,y+4,{width:w-10});
    doc.fontSize(10).text(String(value || ''),x+5,y+16,{width:w-10,height:h-17});
  }
  doc.font('Helvetica-Bold').fontSize(14).text('Banco do Brasil | 001-9');
  doc.font('Helvetica').fontSize(10).text(environment === 'production' ? 'Recibo do pagador' : 'HOMOLOGAÇÃO — SEM VALOR PARA PAGAMENTO',36,62);
  field('Beneficiário',settings.beneficiaryName,36,84,350);
  field('CPF/CNPJ do beneficiário',settings.beneficiaryDocument,386,84,173);
  field('Pagador',p.pagador.nome,36,122,350);
  field('CPF/CNPJ do pagador',String(p.pagador.numeroInscricao).padStart(p.pagador.tipoInscricao===1?11:14,'0'),386,122,173);
  field('Nosso número',charge.externalId,36,160,230);
  field('Vencimento',p.dataVencimento,266,160,120);
  field('Valor do documento',money(p.valorOriginal),386,160,173);
  doc.fontSize(8).text('Autenticação mecânica',400,207);
  doc.dash(3).moveTo(36,245).lineTo(559,245).stroke().undash();
  doc.font('Helvetica-Bold').fontSize(12).text('Banco do Brasil | 001-9',36,265);
  doc.fontSize(9).text(formatted,235,268,{width:324,align:'right'});
  field('Local de pagamento','Pagável em qualquer banco até o vencimento',36,290,350);
  field('Vencimento',p.dataVencimento,386,290,173);
  field('Beneficiário',settings.beneficiaryName,36,328,350);
  field('Agência / Conta',`${settings.agency} / ${settings.account}`,386,328,173);
  field('Data do documento',p.dataEmissao,36,366,100);
  field('Número do documento',p.numeroTituloBeneficiario,136,366,150);
  field('Espécie / Aceite','DM / N',286,366,100);
  field('Nosso número',charge.externalId,386,366,173);
  field('Carteira',String(p.numeroCarteira),36,404,100);
  field('Espécie moeda','R$',136,404,100);
  field('Quantidade / Valor','',236,404,150);
  field('(=) Valor do documento',money(p.valorOriginal),386,404,173);
  const instructions = [environment !== 'production' ? 'HOMOLOGAÇÃO — SEM VALOR PARA PAGAMENTO' : '',
    p.multa?.porcentagem ? `Multa de ${p.multa.porcentagem}% após o vencimento.` : '',
    p.jurosMora?.porcentagem ? `Juros de ${p.jurosMora.porcentagem}% ao mês após o vencimento.` : '',
    p.indicadorAceiteTituloVencido === 'N' ? 'Não receber após o vencimento.' : '',
  ].filter(Boolean).join('\n');
  field('Instruções',instructions,36,442,350,114);
  field('(-) Descontos / Abatimento','',386,442,173);
  field('(+) Juros / Multa','',386,480,173);
  field('(=) Valor cobrado','',386,518,173);
  field('Pagador',`${p.pagador.nome} — CPF/CNPJ: ${String(p.pagador.numeroInscricao).padStart(p.pagador.tipoInscricao===1?11:14,'0')}\n${p.pagador.endereco} — ${p.pagador.cidade}/${p.pagador.uf} — CEP ${String(p.pagador.cep).padStart(8,'0')}`,36,556,523,62);
  doc.font('Helvetica').fontSize(8).text('Ficha de compensação / Autenticação mecânica',330,627,{width:229,align:'right'});
  const image = await bwipjs.toBuffer({bcid:'interleaved2of5',text:barcode,scale:2,height:13,includetext:false});
  doc.image(image,36,650,{width:292,height:37});
  if (settings.beneficiaryAddress) doc.font('Helvetica').fontSize(7).text(settings.beneficiaryAddress,36,704,{width:390});
  const emv = charge.response.qrCode?.emv;
  if (emv) {
    const qr = await bwipjs.toBuffer({bcid:'qrcode',text:emv,scale:2});
    doc.image(qr,454,650,{fit:[90,90]});
    doc.fontSize(7).text('Pix do mesmo boleto',450,744,{width:100,align:'center'});
  }
  doc.end();
  return finished;
}
