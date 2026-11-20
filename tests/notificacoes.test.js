const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const express = require('express');
const jwt = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');
const { endpointPermitido, enviarPushPedido } = require('../services/pushService');
const Destaque = require('../js/destaque');
const root = path.join(__dirname, '..');
function modulo(file, overrides, globals = {}) {
    const filename = path.join(root, file), req = createRequire(filename), module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports,
        require: name => overrides[name] || req(name), console: { error() {}, log() {} }, ...globals }, { filename });
    return module.exports;
}

test('migração e API de notificações com PostgreSQL em memória', async t => {
    const db = new PGlite();
    t.after(() => db.close());
    const schema = fs.readFileSync(path.join(root, 'database/schema.postgresql.sql'), 'utf8').split('-- Notificações persistentes')[0];
    await db.exec(schema);
    await db.exec(`INSERT INTO usuarios (id, nome_completo, email, senha, is_admin) VALUES
        (7, 'Admin A', 'a@example.test', 'hash', TRUE), (8, 'Admin B', 'b@example.test', 'hash', TRUE),
        (9, 'Cliente', 'cliente@example.test', 'hash', FALSE);
        INSERT INTO pedidos (usuario_id, total) VALUES (9, 119);`);
    const migration = fs.readFileSync(path.join(root, 'database/migrations/20261119_notificacoes_push.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await db.query('SELECT * FROM notificacoes_pedidos')).rows.length, 0, 'Sem avisos retroativos');
    const inserir = async () => (await db.query('INSERT INTO pedidos (usuario_id, total) VALUES (9, 119) RETURNING id')).rows[0].id;
    const pedido = await inserir();
    const notificacao = (await db.query('SELECT * FROM notificacoes_pedidos WHERE pedido_id = $1', [pedido])).rows[0];
    assert.ok(notificacao);
    await db.exec('BEGIN');
    const abortado = await inserir();
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT * FROM notificacoes_pedidos WHERE pedido_id = $1', [abortado])).rows.length, 0);

    const secret = 'testes-notificacoes-sem-acesso-producao';
    const ids = { 7: '77777777-7777-4777-8777-777777777777', 8: '88888888-8888-4888-8888-888888888888', 9: '99999999-9999-4999-8999-999999999999' };
    for (const [usuario, id] of Object.entries(ids)) await db.query('INSERT INTO sessoes_usuario (id, usuario_id, expira_em) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'1 day\')', [id, usuario]);
    const pool = { query: (sql, params) => db.query(sql, params) };
    const auth = modulo('middleware/auth.js', { '../config/database': { pool } }, { process: { env: { JWT_SECRET: secret } } });
    const router = modulo('routes/notificacoes.js', { '../config/database': { pool }, '../middleware/auth': auth,
        '../services/pushService': { endpointPermitido, configuracaoPush: () => ({ publicKey: 'chave-publica', privateKey: 'segredo' }) } }, { Buffer });
    const app = express(); app.use(express.json()); app.use('/notificacoes', router);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const request = async (rota, { usuario = 7, method = 'GET', body } = {}) => {
        const headers = { 'Content-Type': 'application/json' };
        if (usuario) headers.Authorization = 'Bearer ' + jwt.sign({ id: usuario, isAdmin: true }, secret, { expiresIn: '1h', jwtid: ids[usuario] });
        const res = await fetch(`http://127.0.0.1:${server.address().port}/notificacoes${rota}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() };
    };
    await t.test('permissão atual do banco protege lista, leitura e configuração push', async () => {
        for (const rota of ['/resumo', '/', '/push/config']) {
            assert.equal((await request(rota, { usuario: null })).status, 401);
            assert.equal((await request(rota, { usuario: 9 })).status, 403);
        }
    });
    await t.test('leitura persiste para um administrador sem afetar outro', async () => {
        const antes = await request('/resumo');
        assert.equal(antes.body.nao_lidas, 1);
        assert.equal(antes.cache, 'private, no-store');
        assert.equal((await request(`/${notificacao.id}/lida`, { method: 'PUT', body: {} })).status, 200);
        assert.equal((await request('/resumo')).body.nao_lidas, 0);
        assert.equal((await request('/resumo', { usuario: 8 })).body.nao_lidas, 1);
        assert.deepEqual((await request('/')).body.notificacoes, [], 'Leitura sai da central e permanece gravada');
        assert.equal((await request('/', { usuario: 8 })).body.notificacoes[0].id, notificacao.id);
        await request(`/${notificacao.id}/lida`, { method: 'PUT', body: {} });
        assert.equal((await db.query('SELECT * FROM notificacoes_leituras')).rows.length, 1);
    });
    await t.test('paginação por cursor não repete itens e leitura em lote preserva avisos mais novos', async () => {
        for (let i = 0; i < 24; i++) await inserir();
        const primeira = (await request('/')).body;
        assert.equal(primeira.notificacoes.length, 20);
        const segunda = (await request(`/?antes=${primeira.proximo_cursor}`)).body;
        assert.equal(segunda.notificacoes.length, 4);
        assert.equal(new Set([...primeira.notificacoes, ...segunda.notificacoes].map(n => n.id)).size, 24);
        const maximo = primeira.notificacoes[0].id;
        const novo = await inserir();
        await request('/lidas', { method: 'PUT', body: { ate_id: maximo } });
        assert.equal((await request('/resumo')).body.nao_lidas, 1);
        await request(`/pedido/${novo}/lida`, { method: 'PUT', body: {} });
        assert.equal((await request('/resumo')).body.nao_lidas, 0);
        assert.deepEqual((await request('/')).body.notificacoes, [], 'Avisos lidos não reaparecem ao recarregar');
        assert.equal((await request('/resumo', { usuario: 8 })).body.nao_lidas, 26);
    });
    await t.test('IDs e páginas inválidos são rejeitados', async () => {
        assert.equal((await request('/?antes=abc')).status, 400);
        assert.equal((await request('/0/lida', { method: 'PUT', body: {} })).status, 400);
        assert.equal((await request('/lidas', { method: 'PUT', body: { ate_id: -1 } })).status, 400);
        assert.equal((await request('/2147483647/lida', { method: 'PUT', body: {} })).status, 404);
    });
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    const inscricao = { endpoint: 'https://fcm.googleapis.com/fcm/send/dispositivo', keys: {
        p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
    await t.test('push valida destino e chaves e vincula inscrição à sessão', async () => {
        for (const endpoint of ['http://fcm.googleapis.com/a', 'https://localhost/a', 'https://fcm.googleapis.com.example.com/a']) {
            assert.equal((await request('/push/inscricao', { method: 'POST', body: { ...inscricao, endpoint } })).status, 400);
        }
        assert.equal((await request('/push/inscricao', { method: 'POST', body: { ...inscricao, keys: { auth: 'invalido', p256dh: 'invalido' } } })).status, 400);
        for (let i = 0; i < 2; i++) assert.equal((await request('/push/inscricao', { method: 'POST', body: inscricao })).status, 201);
        const rows = (await db.query('SELECT * FROM push_inscricoes')).rows;
        assert.equal(rows.length, 1); assert.equal(rows[0].sessao_id, ids[7]);
        await request('/push/inscricao', { usuario: 8, method: 'DELETE', body: { endpoint: inscricao.endpoint } });
        assert.equal((await db.query('SELECT * FROM push_inscricoes')).rows.length, 1);
        const config = await request('/push/config');
        assert.equal(config.body.chave_publica, 'chave-publica');
        assert.doesNotMatch(JSON.stringify(config.body), /segredo|privateKey/);
    });
    await t.test('envio remove destinos expirados e não inclui dados pessoais no push', async () => {
        await db.query('UPDATE push_inscricoes SET endpoint = $1', ['https://fcm.googleapis.com/fcm/send/expirado']);
        let chamadas = 0;
        const resultado = await enviarPushPedido(pool, pedido, { env: { WEBPUSH_PUBLIC_KEY: 'publica', WEBPUSH_PRIVATE_KEY: 'privada', WEBPUSH_SUBJECT: 'https://example.com' },
            enviar: async (sub, payload, options) => {
                chamadas++; assert.doesNotMatch(payload, /email|telefone|nome_completo/);
                assert.equal(options.TTL, 300);
                throw Object.assign(new Error('expirado'), { statusCode: 410 });
            } });
        assert.equal(chamadas, 1); assert.equal(resultado.falhas, 1);
        assert.equal((await db.query('SELECT * FROM push_inscricoes')).rows.length, 0);
    });
    await t.test('encerrar sessão remove as inscrições de push automaticamente', async () => {
        await request('/push/inscricao', { method: 'POST', body: inscricao });
        await db.query('DELETE FROM sessoes_usuario WHERE id = $1', [ids[7]]);
        assert.equal((await db.query('SELECT * FROM push_inscricoes')).rows.length, 0);
        assert.equal((await request('/resumo')).status, 401);
    });
});

test('destaque manual expira em sete dias, não aceita data futura e ignora produtos ocultos', () => {
    const agora = Date.parse('2026-11-19T12:00:00Z');
    const vinhos = [{ id: 2, ativo: true }, { id: 1, ativo: true }, { id: 3, ativo: false }];
    const config = { destaque_vinho_id: 2, destaque_fixado_em: new Date(agora - 1000).toISOString() };
    assert.equal(Destaque.selecionar(vinhos, config, agora).id, 2);
    assert.equal(Destaque.selecionar(vinhos, { ...config, destaque_vinho_id: 3 }, agora).ativo, true);
    const automatico = Destaque.selecionar(vinhos, {}, agora).id;
    assert.equal(Destaque.selecionar(vinhos, { ...config, destaque_fixado_em: new Date(agora + 1000).toISOString() }, agora).id, automatico);
    assert.equal(Destaque.selecionar(vinhos, { ...config, destaque_fixado_em: new Date(agora - 7 * 86400000).toISOString() }, agora).id, automatico);
    assert.equal(Destaque.selecionar([], {}, agora), null);
});

test('destaque automático permanece estável na semana e independe da ordem da API', () => {
    const vinhos = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const segunda = Date.parse('2026-11-16T12:00:00Z');
    const domingo = Date.parse('2026-11-23T02:59:00Z');
    const proxima = Date.parse('2026-11-23T03:00:00Z');
    assert.equal(Destaque.selecionar(vinhos, {}, segunda).id, Destaque.selecionar([...vinhos].reverse(), {}, domingo).id);
    assert.notEqual(Destaque.selecionar(vinhos, {}, segunda).id, Destaque.selecionar(vinhos, {}, proxima).id);
});

test('service worker respeita adesão, oculta dados pessoais e abre somente o próprio painel', async () => {
    const listeners = {}, notificacoes = [], navegacoes = [];
    const memoria = new Map();
    const cache = { async put(key, value) { memoria.set(key, value); }, async match(key) { return memoria.get(key)?.clone(); } };
    const self = { location: { origin: 'https://catalogo.example.com' }, addEventListener: (name, cb) => { listeners[name] = cb; },
        registration: { async showNotification(title, options) { notificacoes.push({ title, options }); } },
        clients: { async matchAll() { return []; }, async openWindow(url) { navegacoes.push(url); } } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
        self, Response, URL, caches: { open: async () => cache }, console: { log() {} }
    });
    const evento = async (tipo, dados) => { let promise; listeners[tipo]({ ...dados, waitUntil: p => { promise = p; } }); await promise; };
    const push = { data: { json: () => ({ pedidoId: 42, corpo: 'Dado pessoal privado', url: 'https://evil.example/' }) } };
    await evento('push', push); assert.equal(notificacoes.length, 0);
    await evento('message', { data: { tipo: 'PUSH_PREFERENCIA', ativo: true } });
    await evento('push', push); assert.equal(notificacoes.length, 1);
    assert.doesNotMatch(JSON.stringify(notificacoes[0]), /Dado pessoal|evil.example/);
    assert.equal(notificacoes[0].options.tag, 'pedido-42');
    await evento('notificationclick', { notification: { close() {}, data: notificacoes[0].options.data } });
    assert.equal(navegacoes[0], 'https://catalogo.example.com/admin.html?pedido=42#pedidos-recebidos');
    await evento('notificationclick', { notification: { close() {}, data: { url: 'https://evil.example/admin.html' } } });
    assert.equal(navegacoes.length, 1);
    await evento('message', { data: { tipo: 'PUSH_PREFERENCIA', ativo: false } });
    await evento('push', push); assert.equal(notificacoes.length, 1);
    await evento('notificationclick', { notification: { close() {}, data: notificacoes[0].options.data } });
    assert.equal(navegacoes[1], 'https://catalogo.example.com/index.html');
});

test('Web Push produz payload cifrado e assinatura VAPID com as chaves do servidor', async () => {
    const webpush = await import('web-push');
    const keys = webpush.generateVAPIDKeys();
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/teste', keys: {
        p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
    const payload = JSON.stringify({ pedidoId: 42, titulo: 'Novo pedido' });
    const detalhe = webpush.generateRequestDetails(subscription, payload, { TTL: 300,
        vapidDetails: { subject: 'https://catalogo.example.com', ...keys } });
    assert.equal(detalhe.headers['Content-Encoding'], 'aes128gcm');
    assert.match(detalhe.headers.Authorization, /^vapid /);
    assert.ok(detalhe.body.length > payload.length);
    assert.equal(detalhe.body.includes(Buffer.from(payload)), false);
});

test('servidor inicia e serve painel e favicon sem interoperabilidade require/ESM', () => {
    const codigo = `
        const assert = require('node:assert/strict');
        assert.throws(() => require('web-push'), { code: 'ERR_REQUIRE_ESM' });
        const id = require.resolve('./config/database');
        require.cache[id] = { id, filename: id, loaded: true, exports: {
            pool: { query: async () => { throw new Error('Consulta inesperada no teste de inicialização'); } },
            testConnection: async () => true
        } };
        (async () => {
            const push = require('./services/pushService');
            assert.equal(typeof push.enviarPushPedido, 'function');
            const sdk = await import('web-push');
            assert.equal(typeof sdk.sendNotification, 'function');
            const app = require('./server');
            const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
            try {
                const origem = 'http://127.0.0.1:' + server.address().port;
                const painel = await fetch(origem + '/admin.html');
                assert.equal(painel.status, 200);
                assert.match(painel.headers.get('content-security-policy'), /script-src-attr 'none'/);
                assert.doesNotMatch(await painel.text(), /<script(?![^>]*\\bsrc=)[^>]*>/i);
                const favicon = await fetch(origem + '/favicon.ico', { redirect: 'manual' });
                assert.equal(favicon.status, 308);
                assert.equal(favicon.headers.get('location'), '/images/favicon.svg');
                assert.equal((await fetch(origem + '/images/favicon.svg')).status, 200);
                console.log('RUNTIME_SMOKE_OK');
            } finally { await new Promise(resolve => server.close(resolve)); }
        })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const resultado = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', codigo], {
        cwd: root, encoding: 'utf8', timeout: 20000,
        env: { ...process.env, NODE_ENV: 'production', VERCEL: '1', DATABASE_URL: 'postgresql://teste:teste@localhost:1/teste',
            JWT_SECRET: 'runtime-testes-sem-segredos-reais', CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
            WEBPUSH_PUBLIC_KEY: '', WEBPUSH_PRIVATE_KEY: '', WEBPUSH_SUBJECT: '' }
    });
    assert.equal(resultado.status, 0, resultado.stderr || resultado.error?.message);
    assert.match(resultado.stdout, /RUNTIME_SMOKE_OK/);
});

function dispositivoPush({ conservarAoDesinscrever = false } = {}) {
    const elementos = new Map(), storage = new Map(), mensagens = [], chamadas = [];
    let usuarioId = 7, token = 'sessao-inicial', desinscricoes = 0, permissoes = 0;
    let inscricao;
    const dispositivo = { endpoint: 'https://fcm.googleapis.com/fcm/send/dispositivo', toJSON: () => ({ endpoint: dispositivo.endpoint, keys: {} }),
        async unsubscribe() { desinscricoes++; if (!conservarAoDesinscrever) inscricao = null; return !conservarAoDesinscrever; } };
    const registro = { active: { postMessage: mensagem => mensagens.push(mensagem) }, pushManager: {
        getSubscription: async () => inscricao,
        subscribe: async () => { inscricao = dispositivo; return dispositivo; }
    } };
    inscricao = dispositivo;
    const window = { authManager: { obterToken: () => token }, PushManager: function() {}, Notification: {}, addEventListener() {} };
    const context = { window, navigator: { serviceWorker: { ready: Promise.resolve(registro), getRegistration: async () => registro } },
        document: { addEventListener() {}, getElementById(id) {
            if (!elementos.has(id)) elementos.set(id, { textContent: '', disabled: true });
            return elementos.get(id);
        } }, Notification: { permission: 'granted', requestPermission: async () => { permissoes++; return 'granted'; } },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        setTimeout, clearTimeout, clearInterval, Uint8Array, atob, console: { log() {} } };
    vm.createContext(context);
    for (const file of ['js/pwa.js', 'js/notificacoes-admin.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    function painel() {
        const instance = new window.NotificacoesAdmin();
        instance.api = async (rota, options) => {
            if (rota === '/push/config') return { disponivel: true, chave_publica: 'BAAA', usuario_id: usuarioId };
            chamadas.push({ rota, method: options.method, token: instance.token });
            return { success: true };
        };
        return instance;
    }
    return { window, painel, chamadas, mensagens, elementos, storage,
        trocarSessao(id = usuarioId) { usuarioId = id; token = 'nova-sessao-' + id; },
        get inscricao() { return inscricao; }, get desinscricoes() { return desinscricoes; }, get permissoes() { return permissoes; } };
}

test('logout suspende o push e o novo login da mesma conta restaura sem nova permissão', async () => {
    const d = dispositivoPush();
    await d.painel().configurarPush();
    d.window.suspenderPushDispositivo();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(d.desinscricoes, 0);
    assert.ok(d.inscricao);
    assert.equal(d.mensagens.at(-1).ativo, false);
    d.trocarSessao();
    await d.painel().configurarPush();
    assert.equal(d.chamadas.filter(c => c.method === 'POST').length, 2);
    assert.equal(d.chamadas.at(-1).token, 'nova-sessao-7');
    assert.equal(d.mensagens.at(-1).ativo, true);
    assert.equal(d.permissoes, 0);
    assert.equal(d.elementos.get('push-alternar').textContent, 'Desativar neste dispositivo');
});

test('desativação explícita permanece desativada após novo login mesmo se o navegador mantiver a inscrição', async () => {
    const d = dispositivoPush({ conservarAoDesinscrever: true });
    const painel = d.painel();
    await painel.configurarPush();
    await painel.alternarPush();
    assert.equal(d.desinscricoes, 1);
    assert.equal(JSON.parse(d.storage.get('davini_push_preferencia')).ativo, false);
    d.trocarSessao();
    await d.painel().configurarPush();
    assert.equal(d.chamadas.filter(c => c.method === 'POST').length, 1);
    assert.equal(d.mensagens.at(-1).ativo, false);
    assert.equal(d.elementos.get('push-alternar').textContent, 'Ativar neste dispositivo');
});

test('preferência de um administrador não ativa automaticamente o dispositivo para outro', async () => {
    const d = dispositivoPush();
    await d.painel().configurarPush();
    d.trocarSessao(8);
    await d.painel().configurarPush();
    assert.equal(d.chamadas.filter(c => c.method === 'POST').length, 1);
    assert.equal(d.mensagens.at(-1).ativo, false);
    assert.equal(d.elementos.get('push-alternar').textContent, 'Ativar neste dispositivo');
});
