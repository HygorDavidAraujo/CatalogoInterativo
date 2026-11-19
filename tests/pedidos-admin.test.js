const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');

const root = path.join(__dirname, '..');
const quiet = { log() {}, error() {} };
function modulo(file, overrides, globals = {}) {
    const filename = path.join(root, file), localRequire = createRequire(filename), module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, require: name => overrides[name] || localRequire(name), console: quiet, ...globals
    }, { filename });
    return module.exports;
}
async function api(t, admin = true) {
    const queries = [];
    const pool = { async query(sql, params) {
        if (sql.includes('FROM sessoes_usuario s')) return { rows: [{ id: 7, is_admin: admin }] };
        queries.push({ sql, params });
        if (sql.includes('AS em_aberto')) return { rows: [{ total: 27, em_aberto: 3 }] };
        if (sql.startsWith('SELECT id FROM pedidos')) return { rows: [{ id: 42 }, { id: 41 }] };
        if (sql.includes('COUNT(*)')) return { rows: [{ total: 27 }] };
        if (sql.includes('json_agg')) return { rows: Number(params[0]) === 404 ? [] : [{ id: 42, usuario_id: 7, status: 'enviado', itens: [{ vinho_nome: 'Merlot', quantidade: 2 }] }] };
        return { rows: [{ id: 42, usuario_id: 7, status: 'processando', total: '20.00' }] };
    } };
    const secret = 'pedidos-admin-testes-apenas';
    const auth = modulo('middleware/auth.js', { '../config/database': { pool } }, { process: { env: { JWT_SECRET: secret } } });
    const router = modulo('routes/pedidos.js', { '../config/database': { pool }, '../middleware/auth': auth,
        '../services/pedidoEmailService': { notificarPedido: async () => {} } });
    const app = express();
    app.use('/api/pedidos', router);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const token = jwt.sign({ id: 7 }, secret, { expiresIn: '1h', jwtid: '11111111-1111-4111-8111-111111111111' });
    return { queries, async get(url, autenticado = true) {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/pedidos${url}`, {
            headers: autenticado ? { Authorization: `Bearer ${token}` } : {}
        });
        return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() };
    } };
}

test('fila, resumo e detalhes exigem sessão e permissão atual de administrador', async t => {
    for (const admin of [true, false]) {
        const app = await api(t, admin);
        for (const rota of ['/resumo', '/recebidos', '/42']) {
            assert.equal((await app.get(rota, false)).status, 401);
            if (!admin) assert.equal((await app.get(rota)).status, 403);
        }
        assert.equal(app.queries.length, 0);
    }
});

test('resumo limitado não carrega itens nem dados pessoais e impede cache', async t => {
    const app = await api(t);
    const res = await app.get('/resumo');
    assert.equal(res.status, 200);
    assert.equal(res.cache, 'private, no-store');
    assert.deepEqual(res.body, { total: 27, em_aberto: 3, recentes: [42, 41] });
    assert.equal(app.queries.length, 2);
    assert.match(app.queries[1].sql, /LIMIT 50/);
    assert.doesNotMatch(app.queries.map(q => q.sql).join(' '), /pedidos_itens|email|telefone/);
});

test('fila pagina por vinte, parametriza busca e normaliza status legado', async t => {
    const app = await api(t);
    const res = await app.get('/recebidos?pagina=2&status=abertos&busca=O%27Hara');
    assert.equal(res.status, 200);
    assert.equal(res.cache, 'private, no-store');
    assert.equal(res.body.por_pagina, 20);
    assert.equal(res.body.pagina, 2);
    assert.equal(res.body.pedidos[0].status, 'em_preparacao');
    assert.deepEqual(Array.from(app.queries[1].params), ['abertos', "O'Hara", 20]);
    assert.match(app.queries[1].sql, /LIMIT 20 OFFSET \$3/);
    assert.doesNotMatch(app.queries[1].sql, /O'Hara/);
});

test('filtros inválidos são rejeitados antes de consultar pedidos', async t => {
    const app = await api(t);
    for (const query of ['pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=9999999', 'status=qualquer', 'status[]=pendente', 'busca[]=abc', `busca=${'a'.repeat(151)}`]) {
        assert.equal((await app.get(`/recebidos?${query}`)).status, 400, query);
    }
    assert.equal(app.queries.length, 0);
});

test('detalhe usa pedido existente, retorna itens e trata pedido inexistente', async t => {
    const app = await api(t);
    const res = await app.get('/42');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'em_rota_entrega');
    assert.equal(res.body.usuario_id, 7);
    assert.equal(res.body.itens[0].quantidade, 2);
    assert.equal(res.cache, 'private, no-store');
    assert.equal((await app.get('/404')).status, 404);
    assert.equal((await app.get('/invalido')).status, 400);
});

function tela() {
    const elements = new Map();
    function el(id) {
        if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', hidden: false, disabled: false,
            dataset: {}, value: '', elements: [], setAttribute() {}, replaceChildren() { this.innerHTML = ''; } });
        return elements.get(id);
    }
    const window = { RenderSeguro: require('../js/render-seguro'), PedidoStatus: require('../js/pedido-status'), authManager: { obterToken: () => 'token' } };
    const context = { window, document: { getElementById: el, addEventListener() {} }, API_URL: '/api',
        URLSearchParams, AbortController, setTimeout, clearTimeout, clearInterval, console: quiet };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/pedidos-admin.js'), 'utf8'), context);
    const painel = new window.PedidosAdmin();
    return { painel, el, context, window };
}

test('notificações ignoram histórico inicial, avisam novos pedidos e não repetem a contagem', async () => {
    const { painel, el } = tela();
    let recentes = [42, 41];
    painel.api = async () => ({ em_aberto: 2, total: recentes.length, recentes });
    await painel.resumo();
    assert.equal(painel.novos.size, 0);
    assert.equal(el('pedidos-novos').hidden, true);
    recentes = [44, 43, 42, 41];
    await painel.resumo();
    assert.equal(painel.novos.size, 2);
    assert.equal(el('pedidos-novos').hidden, false);
    await painel.resumo();
    assert.equal(painel.novos.size, 2);
    painel.api = async () => { throw new Error('offline'); };
    await painel.resumo();
    assert.equal(painel.novos.size, 2);
    assert.match(el('pedidos-resumo').textContent, /Falha/);
});

test('status só confirma após servidor gravar e preserva seleção anterior em falha', async () => {
    const { painel, el } = tela();
    const select = el('pedido-novo-status');
    const form = el('pedido-status-form');
    form.dataset.statusAtual = 'pendente';
    form.elements = [select];
    select.value = 'confirmado';
    painel.api = async () => { throw new Error('Falha ao gravar'); };
    await painel.salvarStatus(42);
    assert.equal(select.value, 'pendente');
    assert.equal(form.dataset.statusAtual, 'pendente');
    assert.equal(select.disabled, false);
    assert.match(el('pedido-status-feedback').textContent, /Falha ao gravar/);
    select.value = 'confirmado';
    painel.api = async (rota, options) => {
        assert.equal(rota, '/42/status');
        assert.equal(JSON.parse(options.body).status, 'confirmado');
        return { status: 'confirmado' };
    };
    painel.listar = painel.resumo = async () => {};
    await painel.salvarStatus(42);
    assert.equal(form.dataset.statusAtual, 'confirmado');
    assert.match(el('pedido-status-feedback').textContent, /histórico do cliente/);
});

test('lista protege nome hostil e descarta respostas antigas de filtros anteriores', async () => {
    const { painel, el } = tela();
    let resolver;
    painel.api = () => new Promise(resolve => { resolver = resolve; });
    const antiga = painel.listar();
    painel.api = async () => ({ total: 1, por_pagina: 20, pedidos: [{ id: 42, total: 10, status: 'pendente', created_at: '2026-01-01', nome_completo: '<img src=x onerror="alert(1)">' }] });
    await painel.listar();
    assert.doesNotMatch(el('pedidos-lista').innerHTML, /<img|onerror="/);
    assert.match(el('pedidos-lista').innerHTML, /&lt;img/);
    resolver({ pedidos: [], total: 0, por_pagina: 20 });
    await antiga;
    assert.match(el('pedidos-lista').innerHTML, /Pedido #42/);
});

test('troca de sessão interrompe consultas e remove os dados do painel', async () => {
    const { painel, el, window } = tela();
    el('pedidos-lista').innerHTML = 'Dados de outro administrador';
    window.authManager.obterToken = () => 'outro-token';
    await assert.rejects(painel.api('/resumo'), /Sessão alterada/);
    assert.equal(el('pedidos-lista').innerHTML, '');
    assert.equal(painel.encerrado, true);
});
