const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const root = path.join(__dirname, '..');
const secret = 'chave-de-autenticacao-exclusiva-dos-testes';
const quietConsole = { log() {}, error() {}, warn() {}, debug() {} };

function carregarModulo(relativePath, overrides = {}, globals = {}) {
    const filename = path.join(root, relativePath);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, console: quietConsole,
        require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name),
        ...globals
    }, { filename });
    return module.exports;
}

function criarSistema(options = {}) {
    const usuario = {
        id: 7, nome_completo: 'Cliente Teste', telefone: '(11)99999-9999',
        email: 'cliente@example.com', senha: 'senha-antiga', is_admin: false,
        is_vip: false, ...options.usuario
    };
    const queries = [];
    const emails = [];
    let resets = structuredClone(options.resets || []);
    const pool = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.includes('FROM usuarios WHERE email = $1')) {
                return { rows: params[0] === usuario.email ? [{ ...usuario }] : [] };
            }
            if (sql.startsWith('INSERT INTO password_resets')) {
                resets.push({ id: resets.length + 1, usuario_id: params[0], token: params[1], expires_at: params[2] });
                return { rows: [] };
            }
            if (sql.startsWith('SELECT pr.id AS pr_id')) {
                const reset = resets.find(row => row.token === params[0]);
                return { rows: reset ? [{ ...reset, pr_id: reset.id, email: usuario.email }] : [] };
            }
            if (sql.startsWith('UPDATE usuarios SET senha =')) {
                assert.equal(params[1], usuario.id);
                usuario.senha = params[0];
                return { rows: [], rowCount: 1 };
            }
            if (sql.startsWith('DELETE FROM password_resets WHERE usuario_id')) {
                resets = resets.filter(row => row.usuario_id !== params[0]);
                return { rows: [] };
            }
            if (sql.startsWith('DELETE FROM password_resets WHERE id')) {
                resets = resets.filter(row => row.id !== params[0]);
                return { rows: [] };
            }
            throw new Error(`Consulta inesperada no teste: ${sql}`);
        }
    };
    const env = {
        JWT_SECRET: secret, NODE_ENV: 'production', APP_URL: 'https://catalogo.example.com',
        RESEND_API_KEY: 'chave-simulada', RESEND_FROM: 'loja@example.com'
    };
    const auth = carregarModulo('middleware/auth.js', {}, { process: { env } });
    class ResendSimulado {
        constructor() {
            this.emails = { send: async mail => {
                emails.push(mail);
                return { data: { id: 'email-simulado' }, error: null };
            } };
        }
    }
    const passthrough = (req, res, next) => next();
    const router = carregarModulo('routes/auth.js', {
        '../config/database': { pool }, '../middleware/auth': auth,
        '../middleware/rateLimiter': { loginLimiter: passthrough, cadastroLimiter: passthrough },
        resend: { Resend: ResendSimulado },
        nodemailer: { createTransport() { throw new Error('SMTP real não deve ser acessado nos testes'); } }
    }, { process: { env } });

    async function post(url, body) {
        const req = {
            method: 'POST', url, originalUrl: `/api/auth${url}`,
            headers: {}, body: structuredClone(body), params: {}, query: {}
        };
        return new Promise((resolve, reject) => {
            const res = {
                statusCode: 200,
                status(code) { this.statusCode = code; return this; },
                json(data) { resolve(JSON.parse(JSON.stringify({ status: this.statusCode, body: data }))); }
            };
            router.handle(req, res, error => reject(error || new Error('Rota não encontrada')));
        });
    }
    return { post, usuario, queries, emails, getResets: () => resets };
}

for (const senha of ['senha-antiga', '', null]) {
    test(`rota antiga não permite alterar senha legada (${String(senha)}) apenas pelo e-mail`, async () => {
        const sistema = criarSistema({ usuario: { senha } });
        const result = await sistema.post('/atualizar-senha', {
            email: sistema.usuario.email, novaSenha: 'senha-injetada'
        });
        assert.equal(result.status, 410);
        assert.equal(result.body.code, 'PASSWORD_RESET_REQUIRED');
        assert.equal(sistema.usuario.senha, senha);
        assert.equal(sistema.queries.length, 0);
        assert.equal(sistema.emails.length, 0);
    });
}

test('rota desativada responde igualmente para e-mail desconhecido ou dados ausentes', async () => {
    const sistema = criarSistema();
    const desconhecido = await sistema.post('/atualizar-senha', { email: 'outro@example.com', novaSenha: 'teste123' });
    const vazio = await sistema.post('/atualizar-senha', {});
    assert.deepEqual(desconhecido, vazio);
    assert.equal(sistema.queries.length, 0);
});

test('login legado encaminha à recuperação sem emitir JWT ou alterar senha', async () => {
    const sistema = criarSistema();
    const result = await sistema.post('/login', { email: sistema.usuario.email, senha: 'qualquer-senha' });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, 'PASSWORD_RESET_REQUIRED');
    assert.equal(result.body.token, undefined);
    assert.equal(sistema.usuario.senha, 'senha-antiga');
    assert.equal(sistema.queries.some(q => q.sql.startsWith('UPDATE')), false);
    assert.equal(sistema.emails.length, 0);
});

test('login bcrypt continua funcionando para cliente e administrador', async () => {
    const senha = await bcrypt.hash('senha-correta', 10);
    for (const is_admin of [false, true]) {
        const sistema = criarSistema({ usuario: { senha, is_admin } });
        const result = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-correta' });
        assert.equal(result.status, 200);
        assert.equal(result.body.success, true);
        assert.equal(result.body.usuario.isAdmin, is_admin);
        const claims = jwt.verify(result.body.token, secret);
        assert.equal(claims.id, sistema.usuario.id);
        assert.equal(claims.isAdmin, is_admin);
        const errado = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-incorreta' });
        assert.equal(errado.status, 401);
        assert.equal(errado.body.token, undefined);
    }
});

test('conta legada só troca senha após usar o link enviado e consegue fazer login depois', async () => {
    const sistema = criarSistema({ usuario: { is_admin: true } });
    const solicitado = await sistema.post('/recuperar', { email: sistema.usuario.email });
    assert.equal(solicitado.status, 200);
    assert.equal(sistema.usuario.senha, 'senha-antiga');
    assert.equal(solicitado.body.token, undefined);
    assert.equal(solicitado.body.tempSenha, undefined);
    assert.equal(sistema.emails.length, 1);
    assert.deepEqual(Array.from(sistema.emails[0].to), [sistema.usuario.email]);
    const reset = sistema.getResets()[0];
    assert.match(reset.token, /^[a-f0-9]{64}$/);
    assert.ok(new Date(reset.expires_at).getTime() > Date.now());
    assert.ok(sistema.emails[0].text.includes(`https://catalogo.example.com/reset-senha.html?token=${reset.token}`));
    assert.equal(JSON.stringify(solicitado.body).includes(reset.token), false);

    const confirmado = await sistema.post('/recuperar/confirmar', { token: reset.token, novaSenha: 'senha-nova-segura' });
    assert.equal(confirmado.status, 200);
    assert.ok(sistema.usuario.senha.startsWith('$2'));
    assert.ok(await bcrypt.compare('senha-nova-segura', sistema.usuario.senha));
    assert.equal(sistema.usuario.is_admin, true);
    assert.equal(sistema.getResets().length, 0);
    const login = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-nova-segura' });
    assert.equal(login.status, 200);

    const repetido = await sistema.post('/recuperar/confirmar', { token: reset.token, novaSenha: 'outra-senha' });
    assert.equal(repetido.status, 400);
    assert.ok(await bcrypt.compare('senha-nova-segura', sistema.usuario.senha));
});

test('token inválido, expirado ou ausente não altera a senha', async () => {
    const tokenExpirado = 'a'.repeat(64);
    const sistema = criarSistema({ resets: [{ id: 1, usuario_id: 7, token: tokenExpirado, expires_at: new Date(Date.now() - 60000) }] });
    for (const token of ['token-invalido', tokenExpirado, '']) {
        const result = await sistema.post('/recuperar/confirmar', { token, novaSenha: 'nova-senha' });
        assert.equal(result.status, 400);
    }
    assert.equal(sistema.usuario.senha, 'senha-antiga');
    assert.equal(sistema.queries.some(q => q.sql.startsWith('UPDATE usuarios')), false);
});

test('recuperação não revela se o e-mail está cadastrado nem devolve senha ou token', async () => {
    const sistema = criarSistema();
    const existente = await sistema.post('/recuperar', { email: sistema.usuario.email });
    const desconhecido = await sistema.post('/recuperar', { email: 'outro@example.com' });
    assert.deepEqual(existente, desconhecido);
    assert.equal(sistema.emails.length, 1);
    assert.equal(sistema.usuario.senha, 'senha-antiga');
});

function criarPagina(fetchImpl, semModal = false) {
    const ids = ['form-login', 'login-email', 'login-senha', 'login-erro', 'modal-auth',
        'modal-recuperar-senha', 'recuperar-email', 'recuperar-senha-erro',
        'recuperar-senha-sucesso', 'form-recuperar-senha', 'esqueci-senha-link'];
    const elements = Object.fromEntries(ids.map(id => [id, {
        value: '', textContent: '', style: { display: 'none' }, handlers: {},
        addEventListener(event, handler) { this.handlers[event] = handler; },
        focus() { this.focused = true; }, reset() {}
    }]));
    if (semModal) delete elements['modal-recuperar-senha'];
    elements['login-email'].value = 'cliente@example.com';
    elements['login-senha'].value = 'senha-antiga';
    elements['modal-auth'].style.display = 'block';
    function storage() {
        const data = new Map();
        return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
    }
    const context = {
        window: { addEventListener() {} }, console: quietConsole,
        document: {
            readyState: 'loading', getElementById: id => elements[id] || null,
            querySelector: () => null, addEventListener() {}
        },
        sessionStorage: storage(), localStorage: storage(),
        API_URL: '/api', fetch: fetchImpl, location: { reload() {} }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8'), context);
    context.authManager = context.window.authManager;
    return { context, elements };
}

test('login da interface abre recuperação com e-mail preenchido sem enviar nova senha ou e-mail automaticamente', async () => {
    const sistema = criarSistema();
    const calls = [];
    const { context, elements } = criarPagina(async (url, options) => {
        calls.push(url);
        const result = await sistema.post('/login', JSON.parse(options.body));
        return { ok: result.status === 200, json: async () => result.body };
    });
    context.configurarFormLogin();
    await elements['form-login'].handlers.submit({ preventDefault() {} });
    assert.deepEqual(calls, ['/api/auth/login']);
    assert.equal(elements['modal-auth'].style.display, 'none');
    assert.equal(elements['modal-recuperar-senha'].style.display, 'block');
    assert.equal(elements['recuperar-email'].value, sistema.usuario.email);
    assert.equal(elements['login-senha'].value, '');
    assert.equal(sistema.emails.length, 0);
    assert.equal(sistema.usuario.senha, 'senha-antiga');

    context.configurarFormRecuperarSenha();
    context.fetch = async (url, options) => {
        assert.equal(url, '/api/auth/recuperar');
        assert.deepEqual(JSON.parse(options.body), { email: sistema.usuario.email });
        const result = await sistema.post('/recuperar', JSON.parse(options.body));
        return { ok: true, json: async () => result.body };
    };
    await elements['form-recuperar-senha'].handlers.submit({ preventDefault() {} });
    assert.equal(sistema.emails.length, 1);
    assert.equal(elements['recuperar-senha-sucesso'].style.display, 'block');
    assert.equal(sistema.usuario.senha, 'senha-antiga');
});

test('link Esqueci minha senha continua abrindo a recuperação com o e-mail do login', () => {
    const { context, elements } = criarPagina(() => { throw new Error('Não deve enviar requisição ao abrir modal'); });
    context.configurarAuth();
    elements['esqueci-senha-link'].handlers.click({ preventDefault() {} });
    assert.equal(elements['modal-recuperar-senha'].style.display, 'block');
    assert.equal(elements['recuperar-email'].value, 'cliente@example.com');
});

test('página sem modal de recuperação mostra orientação sem erro JavaScript', async () => {
    const { context, elements } = criarPagina(async () => ({
        ok: false, json: async () => ({ code: 'PASSWORD_RESET_REQUIRED', error: 'Use Esqueci minha senha.' })
    }), true);
    context.configurarFormLogin();
    await elements['form-login'].handlers.submit({ preventDefault() {} });
    assert.equal(elements['login-erro'].style.display, 'block');
    assert.equal(elements['login-erro'].textContent, 'Use Esqueci minha senha.');
});
