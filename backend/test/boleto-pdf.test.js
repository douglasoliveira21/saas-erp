const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('node:https');
const { HttpException } = require('@nestjs/common');
const { InterService } = require('../dist/modules/inter/inter.service');

const service = () => {
  const svc = Object.create(InterService.prototype);
  svc.logger = { warn() {}, log() {}, error() {} };
  return svc;
};

test('PDF de boleto cancelado informa que deve ser baixado o substituto', async () => {
  const svc = service();
  svc.getBoleto = async () => ({ cobranca: { situacao: 'CANCELADO' } });
  svc._fetchBoletoPdf = async () => { assert.fail('Não deve baixar boleto cancelado'); };
  await assert.rejects(svc.getBoletoPdf('code', 1), error =>
    error.getStatus() === 410 && /novo boleto/.test(error.message));
});

test('processamento não vira erro genérico 400', async () => {
  const svc = service();
  svc.getBoleto = async () => ({ cobranca: { situacao: 'EM_PROCESSAMENTO' } });
  await assert.rejects(svc.getBoletoPdf('code', 1), error =>
    error.getStatus() === 503 && /processando/.test(error.message));
});

test('PDF é tentado novamente depois da confirmação de processamento', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const svc = service();
  let consultations = 0;
  svc.getBoleto = async () => ({ cobranca: { situacao: ++consultations === 1 ? 'EM_PROCESSAMENTO' : 'A_RECEBER' } });
  svc._fetchBoletoPdf = async () => Buffer.from('%PDF-1.7');
  const pending = svc.getBoletoPdf('code');
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(5000);
  assert.equal((await pending).toString(), '%PDF-1.7');
  assert.equal(consultations, 2);
});

test('erros de permissão mantêm status e mensagem sem novas tentativas', async () => {
  const svc = service();
  let count = 0;
  svc.getBoleto = async () => { count++; throw new HttpException('Permissão de leitura recusada', 403); };
  await assert.rejects(svc.getBoletoPdf('code'), /Permissão de leitura recusada/);
  assert.equal(count, 1);
});

async function bankResponse(t, body, status = 200) {
  const svc = service();
  svc.currentTenantId = () => 'tenant';
  svc.requestToken = async () => ({ token: 'fake', creds: { environment: 'sandbox' } });
  svc.getAgentFor = () => undefined;
  svc.credentialsFingerprint = () => 'test';
  t.mock.method(https, 'request', (_options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = () => req;
    req.end = () => process.nextTick(() => {
      const response = new EventEmitter();
      response.statusCode = status;
      response.headers = {};
      callback(response);
      response.emit('data', Buffer.from(body));
      response.emit('end');
    });
    return req;
  });
  return svc._fetchBoletoPdf('code');
}

test('baixa PDF binário', async t => {
  assert.equal((await bankResponse(t, '%PDF-1.7\nbody')).toString(), '%PDF-1.7\nbody');
});

test('baixa PDF em base64 retornado pelo Inter', async t => {
  const pdf = Buffer.from('%PDF-1.7\nbody');
  assert.deepEqual(await bankResponse(t, JSON.stringify({ pdf: pdf.toString('base64') })), pdf);
});

test('resposta 200 sem PDF é rejeitada em vez de salvar JSON como boleto', async t => {
  await assert.rejects(bankResponse(t, JSON.stringify({ status: 'PROCESSANDO' })), error =>
    error.getStatus() === 502 && /PDF válido/.test(error.message));
});

test('motivo do erro do banco é preservado', async t => {
  await assert.rejects(bankResponse(t, JSON.stringify({ detail: 'Documento ainda não disponível' }), 400), error =>
    error.getStatus() === 400 && /Documento ainda não disponível/.test(error.message));
});

