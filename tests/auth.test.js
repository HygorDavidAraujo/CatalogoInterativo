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
    const sessoes = new Map();
    let cadastrado = !options.cadastro;
    let resets = structuredClone(options.resets || []);
    const pool = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.includes('INSERT INTO sessoes_usuario')) {
                if (options.credenciaisAlteradasNoLogin || params[3] !== usuario.senha || params[4] !== usuario.is_admin) {
                    return { rows: [], rowCount: 0 };
                }
                sessoes.set(params[0], { id: params[0], usuario_id: params[1], expira_em: params[2] });
                return { rows: [{ id: params[0] }], rowCount: 1 };
            }
            if (sql.includes('FROM sessoes_usuario s')) {
                if (options.falharAutenticacao) throw new Error('Banco indisponível (simulado)');
                const sessao = sessoes.get(params[0]);
                const valida = sessao && sessao.usuario_id === params[1] && new Date(sessao.expira_em) > new Date();
                return { rows: valida ? [{ id: usuario.id, email: usuario.email, is_admin: usuario.is_admin }] : [] };
            }
            if (sql.startsWith('DELETE FROM sessoes_usuario WHERE id')) {
                if (options.falharLogout) throw new Error('Falha de revogação (simulada)');
                const sessao = sessoes.get(params[0]);
                if (sessao?.usuario_id === params[1]) sessoes.delete(params[0]);
                return { rows: [] };
            }
            if (sql.includes('FROM usuarios WHERE email = $1')) {
                return { rows: cadastrado && params[0] === usuario.email ? [{ ...usuario }] : [] };
            }
            if (sql.startsWith('INSERT INTO usuarios')) {
                if (options.falharCadastro) throw new Error('Falha ao gravar cadastro');
                Object.assign(usuario, {
                    nome_completo: params[0], telefone: params[1], email: params[2], senha: params[3], is_admin: false
                });
                cadastrado = true;
                return { rows: [{ id: usuario.id }], rowCount: 1 };
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
                // Simula o trigger do PostgreSQL ao atualizar a senha.
                if (usuario.senha !== params[0]) sessoes.clear();
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
            if (sql.includes('FROM usuarios WHERE id = $1')) {
                return { rows: Number(params[0]) === usuario.id ? [{ ...usuario }] : [] };
            }
            if (sql.includes('COUNT(*)::int AS total FROM usuarios WHERE is_admin')) {
                return { rows: [{ total: 2 }] };
            }
            if (sql.startsWith('UPDATE usuarios SET') && sql.includes('is_admin = $11')) {
                // Simula o trigger: mudar VIP/perfil sem mudar a permissão não revoga.
                if (usuario.is_admin !== params[10]) sessoes.clear();
                Object.assign(usuario, {
                    nome_completo: params[0], telefone: params[1], is_admin: params[10],
                    is_vip: params[11], vip_tipo: params[12]
                });
                return { rows: [], rowCount: 1 };
            }
            if (sql.includes('FROM usuarios ORDER BY created_at')) return { rows: [{ ...usuario }] };
            throw new Error(`Consulta inesperada no teste: ${sql}`);
        }
    };
    const env = {
        JWT_SECRET: secret, NODE_ENV: 'production', APP_URL: 'https://catalogo.example.com',
        RESEND_API_KEY: 'chave-simulada', RESEND_FROM: 'loja@example.com', ...options.env
    };
    const auth = carregarModulo('middleware/auth.js', { '../config/database': { pool } }, { process: { env } });
    class ResendSimulado {
        constructor() {
            this.emails = { send: async mail => {
                emails.push(mail);
                if (options.resendError) return { data: null, error: { name: 'validation_error', message: 'Recusado' } };
                return { data: { id: 'email-simulado' }, error: null };
            } };
        }
    }
    const passthrough = (req, res, next) => next();
    const emailService = carregarModulo('services/emailService.js', {
        resend: { Resend: ResendSimulado },
        nodemailer: { createTransport() { throw new Error('SMTP real não deve ser acessado nos testes'); } }
    }, { process: { env }, URL, AbortSignal });
    const router = carregarModulo('routes/auth.js', {
        '../services/emailService': emailService,
        '../config/database': { pool }, '../middleware/auth': auth,
        '../middleware/rateLimiter': { loginLimiter: passthrough, cadastroLimiter: passthrough, recuperacaoLimiter: passthrough },
        resend: { Resend: ResendSimulado },
        nodemailer: { createTransport() { throw new Error('SMTP real não deve ser acessado nos testes'); } }
    }, { process: { env } });

    async function request(method, url, body = {}, token) {
        const req = {
            method, url, originalUrl: `/api/auth${url}`,
            headers: token ? { authorization: `Bearer ${token}` } : {},
            body: structuredClone(body), params: {}, query: {}
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
    return {
        post: (url, body, token) => request('POST', url, body, token),
        get: (url, token) => request('GET', url, {}, token),
        put: (url, body, token) => request('PUT', url, body, token),
        usuario, queries, emails, sessoes, getResets: () => resets
    };
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

test('cadastro envia boas-vindas com dados e acesso após gravar a conta com senha protegida', async () => {
    const sistema = criarSistema({ cadastro: true });
    const senha = 'senha-exclusiva-cadastro-123';
    const result = await sistema.post('/cadastro', {
        nome_completo: 'Cliente Novo', telefone: '(11)99999-9999',
        email: 'cliente@example.com', senha, is_admin: true
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.usuario.isAdmin, false);
    assert.equal(sistema.emails.length, 1);
    const email = sistema.emails[0];
    assert.deepEqual(Array.from(email.to), ['cliente@example.com']);
    for (const campo of ['Cliente Novo', 'cliente@example.com', '(11)99999-9999']) {
        assert.ok(email.text.includes(campo));
        assert.ok(email.html.includes(campo));
    }
    assert.match(email.subject, /Cadastro realizado com sucesso/);
    assert.ok(email.text.includes('https://catalogo.example.com/index.html'));
    assert.ok(email.html.includes('href="https://catalogo.example.com/index.html"'));
    assert.match(email.text, /Esqueci minha senha/);
    assert.ok(!JSON.stringify(email).includes(senha));
    assert.ok(!JSON.stringify(email).includes(sistema.usuario.senha));
    assert.ok(!JSON.stringify(result.body).includes(senha));
    assert.ok(await bcrypt.compare(senha, sistema.usuario.senha));
});

test('cadastro duplicado ou inválido não dispara boas-vindas', async () => {
    const sistema = criarSistema();
    const dados = { nome_completo: 'Cliente Novo', telefone: '(11)99999-9999', email: sistema.usuario.email, senha: 'senha-valida' };
    assert.equal((await sistema.post('/cadastro', dados)).status, 400);
    assert.equal((await sistema.post('/cadastro', { ...dados, email: 'invalido' })).status, 400);
    assert.equal(sistema.emails.length, 0);
    assert.equal(sistema.queries.some(q => q.sql.startsWith('INSERT INTO usuarios')), false);
});

test('falha ao gravar cadastro não envia e-mail de sucesso', async () => {
    const sistema = criarSistema({ cadastro: true, falharCadastro: true });
    const result = await sistema.post('/cadastro', {
        nome_completo: 'Cliente Novo', telefone: '(11)99999-9999', email: 'cliente@example.com', senha: 'senha-valida'
    });
    assert.equal(result.status, 500);
    assert.equal(sistema.emails.length, 0);
});

test('falha de envio ou URL inválida preserva o cadastro e permite login', async () => {
    for (const options of [{ resendError: true }, { env: { APP_URL: 'http://localhost:3000' } }]) {
        const sistema = criarSistema({ cadastro: true, ...options });
        const dados = { nome_completo: 'Cliente Novo', telefone: '(11)99999-9999', email: 'cliente@example.com', senha: 'senha-valida' };
        const cadastro = await sistema.post('/cadastro', dados);
        assert.equal(cadastro.status, 201);
        assert.equal(cadastro.body.success, true);
        const login = await sistema.post('/login', { email: dados.email, senha: dados.senha });
        assert.equal(login.status, 200);
        assert.equal(login.body.success, true);
    }
});

test('diagnóstico e envio de teste exigem administrador autenticado', async () => {
    const sistema = criarSistema({ usuario: { senha: await bcrypt.hash('senha-valida', 10) } });
    assert.equal((await sistema.get('/test-email')).status, 401);
    assert.equal((await sistema.post('/test-email', { email: 'teste@example.com' })).status, 401);
    const login = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-valida' });
    assert.equal((await sistema.get('/test-email', login.body.token)).status, 403);
    assert.equal((await sistema.post('/test-email', { email: 'teste@example.com' }, login.body.token)).status, 403);
    assert.equal(sistema.emails.length, 0);
});

test('administrador diagnostica sem enviar e testa com destinatário explícito', async () => {
    const sistema = criarSistema({ usuario: { is_admin: true, senha: await bcrypt.hash('senha-valida', 10) } });
    const login = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-valida' });
    const token = login.body.token;
    const diagnostico = await sistema.get('/test-email', token);
    assert.equal(diagnostico.status, 200);
    assert.equal(diagnostico.body.resendConfigurado, true);
    assert.ok(!JSON.stringify(diagnostico.body).includes('chave-simulada'));
    assert.equal(sistema.emails.length, 0);
    assert.equal((await sistema.post('/test-email', {}, token)).status, 400);
    const enviado = await sistema.post('/test-email', { email: 'teste@example.com' }, token);
    assert.equal(enviado.status, 200);
    assert.equal(enviado.body.provider, 'resend');
    assert.equal(sistema.emails[0].to[0], 'teste@example.com');
});

test('falha de provedor na recuperação mantém resposta genérica e não retorna token', async () => {
    const sistema = criarSistema({ resendError: true });
    const existente = await sistema.post('/recuperar', { email: sistema.usuario.email });
    const ausente = await sistema.post('/recuperar', { email: 'outro@example.com' });
    assert.deepEqual(existente, ausente);
    assert.equal(existente.body.token, undefined);
});

test('recuperação normaliza e-mail igual ao cadastro e rejeita entradas inválidas', async () => {
    const sistema = criarSistema({ usuario: { email: 'clienteteste@gmail.com' } });
    const result = await sistema.post('/recuperar', { email: ' Cliente.Teste+loja@gmail.com ' });
    assert.equal(result.status, 200);
    assert.equal(sistema.emails.length, 1);
    for (const email of ['', 'invalido', {}, ['cliente@example.com']]) {
        assert.equal((await sistema.post('/recuperar', { email })).status, 400);
    }
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
    const windowEvents = {};
    const documentEvents = {};
    const avisos = [];
    let recarregamentos = 0;
    const location = { pathname: '/', reload() { recarregamentos++; } };
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
        window: { location, addEventListener: (event, handler) => { windowEvents[event] = handler; } },
        console: quietConsole,
        document: {
            readyState: 'loading', getElementById: id => elements[id] || null,
            querySelector: () => null,
            addEventListener: (event, handler) => { documentEvents[event] = handler; }
        },
        sessionStorage: storage(), localStorage: storage(),
        API_URL: '/api', fetch: fetchImpl, location,
        AbortController, setTimeout, clearTimeout, alert: mensagem => avisos.push(mensagem)
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8'), context);
    context.authManager = context.window.authManager;
    return { context, elements, windowEvents, documentEvents, avisos, getRecarregamentos: () => recarregamentos };
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

async function sistemaComLogin(options = {}) {
    const senha = await bcrypt.hash('senha-segura', 10);
    const sistema = criarSistema({ ...options, usuario: { senha, ...options.usuario } });
    const result = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-segura' });
    assert.equal(result.status, 200);
    return { ...sistema, token: result.body.token };
}

function conectarPagina(pagina, token = 'token-simulado') {
    const manager = pagina.context.authManager;
    manager.salvarUsuarioSessao({ id: 7, nome: 'Cliente Teste', isAdmin: false }, token);
    pagina.context.localStorage.setItem('carrinho', '[{"id":1,"quantidade":2}]');
    return manager;
}

test('login registra sessão e permite consultar /me com o JWT emitido', async () => {
    const sistema = await sistemaComLogin();
    const claims = jwt.verify(sistema.token, secret);
    assert.match(claims.jti, /^[a-f0-9-]{36}$/);
    assert.equal(sistema.sessoes.size, 1);
    const sessao = sistema.sessoes.get(claims.jti);
    assert.equal(sessao.usuario_id, sistema.usuario.id);
    assert.equal(new Date(sessao.expira_em).getTime(), claims.exp * 1000);
    assert.equal(claims.exp - claims.iat, 7 * 24 * 60 * 60);
    const result = await sistema.get('/me', sistema.token);
    assert.equal(result.status, 200);
    assert.equal(result.body.id, sistema.usuario.id);
});

test('logout revoga o token copiado e preserva a sessão de outro dispositivo', async () => {
    const sistema = await sistemaComLogin();
    const segundoLogin = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-segura' });
    const segundoToken = segundoLogin.body.token;
    assert.notEqual(sistema.token, segundoToken);
    assert.equal(sistema.sessoes.size, 2);
    const encerrado = await sistema.post('/logout', {
        sessaoId: jwt.decode(segundoToken).jti, usuario_id: 999
    }, sistema.token);
    assert.equal(encerrado.status, 200);
    assert.equal(sistema.sessoes.size, 1);
    assert.equal((await sistema.get('/me', sistema.token)).status, 401);
    assert.equal((await sistema.get('/me', segundoToken)).status, 200);
    assert.equal((await sistema.post('/logout', {}, sistema.token)).status, 401);
});

test('logout sem autenticação não altera sessões', async () => {
    const sistema = await sistemaComLogin();
    const result = await sistema.post('/logout', {});
    assert.equal(result.status, 401);
    assert.equal(sistema.sessoes.size, 1);
});

test('tokens antigos sem sessão, adulterados ou expirados são recusados', async () => {
    const sistema = await sistemaComLogin();
    const jti = jwt.decode(sistema.token).jti;
    const tokens = [
        jwt.sign({ id: 7, isAdmin: true }, secret),
        jwt.sign({ id: 7 }, secret, { jwtid: '22222222-2222-4222-8222-222222222222' }),
        jwt.sign({ id: 7 }, 'outra-chave', { jwtid: jti }),
        jwt.sign({ id: 7 }, secret, { jwtid: jti, expiresIn: -1 })
    ];
    for (const token of tokens) assert.equal((await sistema.get('/me', token)).status, 401);
    assert.equal(sistema.sessoes.size, 1);
});

test('sessão vencida no banco é recusada mesmo com JWT ainda válido', async () => {
    const sistema = await sistemaComLogin();
    sistema.sessoes.get(jwt.decode(sistema.token).jti).expira_em = new Date(Date.now() - 1000);
    assert.equal((await sistema.get('/me', sistema.token)).status, 401);
});

test('troca de senha revoga todas as sessões e o novo login continua funcionando', async () => {
    const sistema = await sistemaComLogin();
    const segundo = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-segura' });
    await sistema.post('/recuperar', { email: sistema.usuario.email });
    const reset = sistema.getResets()[0];
    const result = await sistema.post('/recuperar/confirmar', { token: reset.token, novaSenha: 'nova-senha-segura' });
    assert.equal(result.status, 200);
    assert.equal(sistema.sessoes.size, 0);
    assert.equal((await sistema.get('/me', sistema.token)).status, 401);
    assert.equal((await sistema.get('/me', segundo.body.token)).status, 401);
    assert.equal((await sistema.post('/login', { email: sistema.usuario.email, senha: 'nova-senha-segura' })).status, 200);
});

test('alterar permissão administrativa revoga a sessão anterior', async () => {
    const sistema = await sistemaComLogin({ usuario: { is_admin: true } });
    const result = await sistema.put('/usuarios/7', {
        nome: sistema.usuario.nome_completo, telefone: sistema.usuario.telefone,
        is_admin: false, is_vip: false
    }, sistema.token);
    assert.equal(result.status, 200);
    assert.equal(sistema.usuario.is_admin, false);
    assert.equal(sistema.sessoes.size, 0);
    assert.equal((await sistema.get('/usuarios', sistema.token)).status, 401);
});

test('permissões atuais do banco prevalecem sobre isAdmin antigo do JWT', async () => {
    const sistema = await sistemaComLogin({ usuario: { is_admin: true } });
    // Defesa adicional mesmo se uma sessão ainda existir durante uma mudança.
    sistema.usuario.is_admin = false;
    assert.equal(jwt.decode(sistema.token).isAdmin, true);
    assert.equal((await sistema.get('/usuarios', sistema.token)).status, 403);
});

test('editar perfil/VIP sem mudar permissão não encerra sessão', async () => {
    const sistema = await sistemaComLogin({ usuario: { is_admin: true } });
    const result = await sistema.put('/usuarios/7', {
        nome: 'Nome Atualizado', telefone: sistema.usuario.telefone,
        is_admin: true, is_vip: true, vip_tipo: 'ouro'
    }, sistema.token);
    assert.equal(result.status, 200);
    assert.equal(sistema.sessoes.size, 1);
    const me = await sistema.get('/me', sistema.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.nome, 'Nome Atualizado');
    assert.equal(me.body.is_vip, true);
});

test('mudança de credenciais durante o login impede emissão de sessão obsoleta', async () => {
    const sistema = criarSistema({
        usuario: { senha: await bcrypt.hash('senha-segura', 10) }, credenciaisAlteradasNoLogin: true
    });
    const result = await sistema.post('/login', { email: sistema.usuario.email, senha: 'senha-segura' });
    assert.equal(result.status, 401);
    assert.equal(result.body.token, undefined);
    assert.equal(sistema.sessoes.size, 0);
});

test('indisponibilidade do banco responde 503 e não autoriza nem trata sessão como expirada', async () => {
    const outro = criarSistema({ usuario: { senha: await bcrypt.hash('senha-segura', 10) }, falharAutenticacao: true });
    const login = await outro.post('/login', { email: outro.usuario.email, senha: 'senha-segura' });
    const result = await outro.get('/me', login.body.token);
    assert.equal(result.status, 503);
    assert.equal(outro.sessoes.size, 1);
});

test('logout da interface limpa os dois armazenamentos, preserva carrinho e revoga no servidor', async () => {
    const sistema = await sistemaComLogin();
    const pagina = criarPagina(async (url, options) => {
        assert.equal(url, '/api/auth/logout');
        assert.equal(options.method, 'POST');
        const result = await sistema.post('/logout', {}, options.headers.Authorization.replace('Bearer ', ''));
        return { ok: result.status === 200, status: result.status };
    });
    const manager = conectarPagina(pagina, sistema.token);
    pagina.context.localStorage.setItem('usuario', 'cache-antigo');
    await manager.logout();
    for (const storage of [pagina.context.localStorage, pagina.context.sessionStorage]) {
        assert.equal(storage.getItem('jwt_token'), null);
        assert.equal(storage.getItem('usuario'), null);
    }
    assert.equal(manager.isLogado(), false);
    assert.equal(pagina.context.localStorage.getItem('carrinho'), '[{"id":1,"quantidade":2}]');
    assert.equal((await sistema.get('/me', sistema.token)).status, 401);
    assert.equal(pagina.avisos.length, 0);
    assert.equal(pagina.getRecarregamentos(), 1);
});

test('logout sem conexão ainda limpa credenciais e informa falha de revogação', async () => {
    const pagina = criarPagina(async () => { throw new Error('Sem conexão'); });
    const manager = conectarPagina(pagina);
    await manager.logout();
    assert.equal(pagina.context.localStorage.getItem('jwt_token'), null);
    assert.equal(pagina.context.sessionStorage.getItem('jwt_token'), null);
    assert.equal(manager.usuarioLogado, null);
    assert.equal(pagina.avisos.length, 1);
    assert.equal(pagina.getRecarregamentos(), 1);
});

test('logout em outra aba remove token e usuário da aba atual sem apagar carrinho', () => {
    const pagina = criarPagina(() => { throw new Error('Não deve chamar API no evento de outra aba'); });
    conectarPagina(pagina);
    pagina.context.configurarAuth();
    pagina.windowEvents.storage({ key: 'jwt_token', newValue: null });
    assert.equal(pagina.context.sessionStorage.getItem('jwt_token'), null);
    assert.equal(pagina.context.sessionStorage.getItem('usuario'), null);
    assert.equal(pagina.context.authManager.usuarioLogado, null);
    assert.notEqual(pagina.context.localStorage.getItem('carrinho'), null);
    assert.equal(pagina.getRecarregamentos(), 1);
});

test('token persistido só restaura usuário após validação de /me', async () => {
    const pagina = criarPagina(async () => ({
        ok: true, status: 200, json: async () => ({ id: 7, nome: 'Cliente Validado', isAdmin: false })
    }));
    pagina.context.localStorage.setItem('jwt_token', 'token-persistido');
    assert.equal(pagina.context.authManager.isLogado(), false);
    assert.equal(await pagina.context.authManager.validarSessao(), true);
    assert.equal(pagina.context.authManager.usuarioLogado.nome, 'Cliente Validado');
    assert.equal(pagina.context.authManager.isLogado(), true);
});

test('401 na validação limpa a sessão e redireciona página administrativa', async () => {
    const pagina = criarPagina(async () => ({ ok: false, status: 401 }));
    const manager = conectarPagina(pagina);
    pagina.context.window.location.pathname = '/admin.html';
    assert.equal(await manager.validarSessao(), false);
    assert.equal(manager.usuarioLogado, null);
    assert.equal(pagina.context.window.location.href, 'index.html');
    assert.equal(pagina.context.localStorage.getItem('jwt_token'), null);
});

test('503 ou falha de rede durante validação não apaga credenciais', async () => {
    for (const fetchImpl of [async () => ({ ok: false, status: 503 }), async () => { throw new Error('Sem rede'); }]) {
        const pagina = criarPagina(fetchImpl);
        const manager = conectarPagina(pagina);
        assert.equal(await manager.validarSessao(), null);
        assert.equal(manager.obterToken(), 'token-simulado');
        assert.equal(manager.isLogado(), true);
        assert.equal(pagina.getRecarregamentos(), 0);
    }
});

test('resposta de /me atrasada não restaura uma sessão já encerrada', async () => {
    let responder;
    const pagina = criarPagina(() => new Promise(resolve => { responder = resolve; }));
    const manager = conectarPagina(pagina);
    const pendente = manager.validarSessao();
    manager.limparSessao();
    responder({ ok: true, status: 200, json: async () => ({ id: 7, nome: 'Cliente Antigo' }) });
    assert.equal(await pendente, false);
    assert.equal(manager.usuarioLogado, null);
    assert.equal(manager.obterToken(), null);
});

test('cache de usuário corrompido ou sem token não mantém login aparente', () => {
    const pagina = criarPagina(() => { throw new Error('Não deve acessar API ao ler cache'); });
    pagina.context.sessionStorage.setItem('usuario', '{json-corrompido');
    pagina.context.authManager.carregarUsuarioSessao();
    assert.equal(pagina.context.authManager.usuarioLogado, null);
    pagina.context.sessionStorage.setItem('usuario', JSON.stringify({ id: 7, nome: 'Cliente' }));
    pagina.context.authManager.carregarUsuarioSessao();
    assert.equal(pagina.context.authManager.isLogado(), false);
    assert.equal(pagina.context.sessionStorage.getItem('usuario'), null);
});

test('novo login em outra aba substitui token e descarta usuário anterior em cache', () => {
    const pagina = criarPagina(() => { throw new Error('Não deve chamar API antes do reload'); });
    conectarPagina(pagina, 'token-antigo');
    pagina.context.configurarAuth();
    pagina.context.localStorage.setItem('jwt_token', 'token-novo');
    pagina.windowEvents.storage({ key: 'jwt_token', newValue: 'token-novo' });
    assert.equal(pagina.context.authManager.obterToken(), 'token-novo');
    assert.equal(pagina.context.sessionStorage.getItem('jwt_token'), 'token-novo');
    assert.equal(pagina.context.sessionStorage.getItem('usuario'), null);
    assert.equal(pagina.context.authManager.usuarioLogado, null);
    assert.equal(pagina.getRecarregamentos(), 1);
});

test('401 atrasado da sessão antiga não apaga login novo feito em outra aba', async () => {
    let responder;
    const pagina = criarPagina(() => new Promise(resolve => { responder = resolve; }));
    const manager = conectarPagina(pagina, 'token-antigo');
    const pendente = manager.validarSessao();
    pagina.context.localStorage.setItem('jwt_token', 'token-novo');
    responder({ ok: false, status: 401 });
    assert.equal(await pendente, false);
    assert.equal(manager.obterToken(), 'token-novo');
    assert.equal(pagina.context.localStorage.getItem('jwt_token'), 'token-novo');
    assert.equal(pagina.getRecarregamentos(), 0);
});
