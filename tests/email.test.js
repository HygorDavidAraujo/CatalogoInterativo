const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createEmailService, getAppUrl, escapeHtml } = require('../services/emailService');

const mensagem = { to: 'cliente@example.com', subject: 'Assunto', text: 'Conteúdo privado' };
const quiet = { error() {} };

function criarEnvio(options = {}) {
    const enviados = [], transportes = [];
    class ResendSimulado {
        constructor() {
            this.emails = { async send(mail, opts) {
                enviados.push({ provider: 'resend', mail, opts });
                if (options.throwResend) throw new Error('Falha de rede');
                return options.resposta || { data: { id: 'email-123' }, error: null };
            } };
        }
    }
    const smtp = { createTransport(config) {
        const registro = { config, closed: false };
        transportes.push(registro);
        return {
            async sendMail(mail) {
                enviados.push({ provider: 'smtp', mail });
                if (options.erroSmtp) throw options.erroSmtp;
                if (options.timeout587 && config.port === 587) throw Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT', command: 'CONN' });
                return { accepted: options.recusado ? [] : [mail.to], rejected: options.recusado ? [mail.to] : [] };
            },
            close() { registro.closed = true; }
        };
    } };
    const service = createEmailService({
        env: { RESEND_API_KEY: 'simulada', RESEND_FROM: 'resend@example.com',
            SMTP_USER: 'loja@gmail.com', SMTP_PASS: 'simulada', SMTP_FROM: 'Loja <loja@gmail.com>', ...options.env },
        ResendClient: ResendSimulado, smtp, logger: quiet
    });
    return { ...service, enviados, transportes };
}

test('Resend exige confirmação com ID e não chama SMTP após sucesso', async () => {
    const service = criarEnvio();
    const result = await service.sendMail(mensagem);
    assert.equal(result.success, true);
    assert.equal(result.info.id, 'email-123');
    assert.equal(service.transportes.length, 0);
    assert.deepEqual(service.enviados[0].mail.to, [mensagem.to]);
    assert.ok(service.enviados[0].opts.signal instanceof AbortSignal);
});

for (const [nome, options] of [
    ['erro retornado sem exceção', { resposta: { data: null, error: { name: 'validation_error', message: 'Domínio não verificado' } } }],
    ['resposta sem ID', { resposta: { data: {}, error: null } }],
    ['falha de rede', { throwResend: true }]
]) {
    test(`Resend com ${nome} tenta SMTP com remetente próprio`, async () => {
        const service = criarEnvio(options);
        const result = await service.sendMail(mensagem);
        assert.equal(result.success, true);
        assert.equal(result.transporterType, 'gmail-smtp:587');
        assert.equal(service.enviados[0].mail.from, 'resend@example.com');
        assert.equal(service.enviados[1].mail.from, 'Loja <loja@gmail.com>');
        assert.equal(result.attempts.length, 1);
        assert.equal(service.transportes[0].closed, true);
    });
}

test('Gmail sem Resend detecta host, usa TLS e porta 465', async () => {
    const service = criarEnvio({ env: { RESEND_API_KEY: '', SMTP_PORT: '465', SMTP_SECURE: 'true' } });
    assert.equal((await service.sendMail(mensagem)).success, true);
    const config = service.transportes[0].config;
    assert.equal(config.host, 'smtp.gmail.com');
    assert.equal(config.secure, true);
    assert.notEqual(config.tls?.rejectUnauthorized, false);
    assert.equal(config.debug, false);
});

test('host SMTP explícito prevalece sobre detecção Gmail', async () => {
    const service = criarEnvio({ env: { RESEND_API_KEY: '', SMTP_HOST: 'smtp.empresa.com', SMTP_PORT: '587' } });
    assert.equal((await service.sendMail(mensagem)).success, true);
    assert.equal(service.transportes[0].config.host, 'smtp.empresa.com');
    assert.equal(service.transportes[0].config.requireTLS, true);
});

test('Gmail tenta 465 se a conexão à porta 587 expirar antes do envio', async () => {
    const service = criarEnvio({ env: { RESEND_API_KEY: '' }, timeout587: true });
    assert.equal((await service.sendMail(mensagem)).transporterType, 'gmail-smtp:465');
    assert.deepEqual(service.transportes.map(t => t.config.port), [587, 465]);
    assert.ok(service.transportes.every(t => t.closed));
});

test('erro de autenticação ou timeout durante transmissão não provoca segundo envio SMTP', async () => {
    for (const erroSmtp of [{ code: 'EAUTH' }, { code: 'ETIMEDOUT', command: 'DATA' }]) {
        const service = criarEnvio({ env: { RESEND_API_KEY: '' }, erroSmtp });
        assert.equal((await service.sendMail(mensagem)).success, false);
        assert.equal(service.transportes.length, 1);
    }
});

test('SMTP com destinatário rejeitado e ausência de provedores não retornam sucesso', async () => {
    const rejeitado = criarEnvio({ env: { RESEND_API_KEY: '' }, recusado: true });
    assert.equal((await rejeitado.sendMail(mensagem)).success, false);
    const vazio = createEmailService({ env: {}, logger: quiet });
    assert.equal((await vazio.sendMail(mensagem)).success, false);
});

test('URL pública é obrigatória em produção e aceita domínio canônico da Vercel', () => {
    for (const APP_URL of ['', 'http://localhost:3000', 'https://localhost', 'javascript:alert(1)', 'http://loja.com']) {
        assert.throws(() => getAppUrl({ NODE_ENV: 'production', APP_URL }));
    }
    assert.equal(getAppUrl({ NODE_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'loja.vercel.app' }), 'https://loja.vercel.app');
    assert.equal(getAppUrl({ APP_URL: 'https://loja.com/' }), 'https://loja.com');
    assert.equal(escapeHtml('<img src="x">&'), '&lt;img src=&quot;x&quot;&gt;&amp;');
});

function criarNotificacao(options = {}) {
    const enviados = [];
    const filename = path.join(__dirname, '../services/pedidoEmailService.js');
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, console: quiet,
        process: { env: options.env || { ORDER_NOTIFICATION_EMAIL: 'loja@example.com,gerente@example.com,loja@example.com' } },
        require: name => name === './emailService' ? {
            escapeHtml, getAppUrl: () => 'https://loja.com',
            async sendMail(mail) { enviados.push(mail); return { success: !options.falharEnvio }; }
        } : localRequire(name)
    });
    const pool = { async query(sql) {
        if (options.falharBanco) throw new Error('Banco indisponível');
        if (sql.includes('FROM pedidos p')) return { rows: [{ id: 42, status: 'pendente', total: '123.45',
            email: 'cliente@example.com', nome_completo: '<img onerror="x">', observacoes: '<script>teste</script>' }] };
        if (sql.includes('FROM pedidos_itens')) return { rows: [{ quantidade: 1, vinho_nome: 'Vinho <especial>', subtotal: '123.45' }] };
        if (sql.includes('FROM configuracoes')) return { rows: options.configEmail ? [{ email: options.configEmail }] : [] };
        if (sql.includes('FROM usuarios')) return { rows: [{ email: 'admin@example.com' }] };
        throw new Error('Consulta inesperada');
    } };
    return { enviados, async notificar(evento) { return module.exports.notificarPedido(pool, 42, evento); } };
}

test('novo pedido envia confirmação ao cliente e mensagens separadas à loja com valores do banco', async () => {
    const service = criarNotificacao();
    await service.notificar({ novo: true });
    assert.deepEqual(service.enviados.map(mail => mail.to), ['cliente@example.com', 'loja@example.com', 'gerente@example.com']);
    assert.match(service.enviados[0].text, /123,45/);
    assert.match(service.enviados[0].text, /Vinho <especial>/);
    assert.match(service.enviados[0].html, /&lt;script&gt;/);
    assert.ok(!service.enviados[0].html.includes('<img'));
    assert.equal(service.enviados[1].replyTo, 'cliente@example.com');
});

test('mudanças de status notificam somente cliente para todos os estados', async () => {
    const statuses = require('../js/pedido-status');
    for (const status of statuses.valores) {
        const service = criarNotificacao();
        await service.notificar({ status });
        assert.equal(service.enviados.length, 1);
        assert.ok(service.enviados[0].subject.includes(statuses.obter(status).label));
    }
});

test('loja usa e-mail das configurações ou administradores quando variável não definida', async () => {
    for (const configEmail of ['contato@example.com', '']) {
        const service = criarNotificacao({ env: {}, configEmail });
        await service.notificar({ novo: true });
        assert.equal(service.enviados[1].to, configEmail || 'admin@example.com');
    }
});

test('indisponibilidade dos provedores ou erro no banco da notificação não lança erro no pedido confirmado', async () => {
    for (const options of [{ falharEnvio: true }, { falharBanco: true }]) {
        const service = criarNotificacao(options);
        await assert.doesNotReject(() => service.notificar({ novo: true }));
    }
});
