const test = require('node:test');
const assert = require('node:assert/strict');
const { SuperAdminAuthService } = require('../dist/modules/platform/super-admin-auth.service');
const { MailService } = require('../dist/modules/mail/mail.service');
const { currentTenantId, runInTenant } = require('../dist/common/tenant/tenant-context.service');

function authFixture(send) {
  const updates = [];
  const removed = [];
  const records = [{ id: 'old-code', used: false }];
  const repository = {
    create: value => value,
    save: async value => { const row = { id: 'new-code', ...value }; records.push(row); return row; },
    delete: async id => { removed.push(id); },
    manager: {
      transaction: async callback => callback({
        update: async (_type, criteria, values) => updates.push({ criteria, values }),
      }),
    },
  };
  const service = new SuperAdminAuthService(
    { findOne: async () => ({ id: 'admin', active: true, email: 'admin@example.com' }) },
    repository, { verify: () => ({ sub: 'admin', type: 'super_admin_2fa_pending' }) },
    { sendPlatformSecurityMail: send },
  );
  return { service, records, updates, removed };
}

test('envio falhou: não libera o login nem invalida código anterior', async () => {
  const { service, records, updates, removed } = authFixture(async () => false);
  await assert.rejects(service.resendCode('pending'), error => error.getStatus() === 503);
  assert.equal(records[1].used, true);
  assert.deepEqual(updates, []);
  assert.deepEqual(removed, ['new-code']);
});

test('falha de transporte também impede sucesso falso no reenvio', async () => {
  const { service, updates } = authFixture(async () => { throw new Error('SMTP indisponível'); });
  await assert.rejects(service.resendCode('pending'), error => error.getStatus() === 503);
  assert.deepEqual(updates, []);
});

test('código novo só é ativado depois do envio e código é armazenado como hash', async () => {
  let sentCode;
  const fixture = authFixture(async (_to, _subject, html) => {
    sentCode = html.match(/letter-spacing:4px">(\d{6})</)[1];
    assert.equal(fixture.records[1].used, true);
    assert.equal(fixture.updates.length, 0);
    return true;
  });
  const result = await fixture.service.resendCode('pending');
  assert.equal(result.success, true);
  assert.equal(fixture.records[1].codeHash.length, 64);
  assert.notEqual(fixture.records[1].codeHash, sentCode);
  assert.deepEqual(fixture.updates, [
    { criteria: { superAdminId: 'admin', used: false }, values: { used: true } },
    { criteria: 'new-code', values: { used: false } },
  ]);
});

function mailFixture(config, transport) {
  const service = Object.create(MailService.prototype);
  const logs = [];
  service.logger = { log() {}, error() {} };
  service.getEnvConfig = () => config;
  service.getConfig = async () => assert.fail('2FA não deve consultar configuração de tenant');
  service.createTransporter = received => {
    assert.equal(received, config);
    return { sendMail: transport };
  };
  service.saveDeliveryLog = async (...args) => logs.push(args);
  return { service, logs };
}

const platform = {
  provider: 'smtp', host: 'smtp.example.com', port: 587, authUser: 'platform@example.com',
  authPass: 'example', fromEmail: 'platform@example.com', fromName: 'Plataforma',
  copyEnabled: true, copyEmail: 'finance@example.com',
};

test('e-mail de segurança usa conta da plataforma sem enviar cópia do código', async () => {
  const { service, logs } = mailFixture(platform, async message => {
    assert.equal(message.from, '"Plataforma" <platform@example.com>');
    assert.equal(message.to, 'admin@example.com');
    assert.equal(message.cc, undefined);
    assert.equal(currentTenantId(), null);
    return { rejected: [] };
  });
  await runInTenant('tenant-1', async () => {
    assert.equal(await service.sendPlatformSecurityMail('admin@example.com', 'Código', 'Mensagem'), true);
    assert.equal(currentTenantId(), 'tenant-1');
  });
  assert.equal(logs[0][3], 'sent');
});

test('SMTP da plataforma ausente informa falha em vez de usar conta de outra empresa', async () => {
  const { service, logs } = mailFixture({ provider: 'smtp' }, async () => assert.fail('Não deve enviar'));
  assert.equal(await service.sendPlatformSecurityMail('admin@example.com', 'Código', 'Mensagem'), false);
  assert.equal(logs[0][3], 'failed');
  assert.match(logs[0][4], /MAIL_HOST/);
});

test('destinatário rejeitado pelo SMTP é registrado como falha', async () => {
  const { service, logs } = mailFixture(platform, async () => ({ rejected: ['admin@example.com'] }));
  assert.equal(await service.sendPlatformSecurityMail('admin@example.com', 'Código', 'Mensagem'), false);
  assert.equal(logs[0][3], 'failed');
});

