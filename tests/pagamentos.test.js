const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');
const service = require('../services/infinitepayService');
const root = path.join(__dirname, '..');
function modulo(file, overrides, globals = {}) {
    const filename = path.join(root, file), local = createRequire(filename), module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports,
        require: name => overrides[name] || local(name), console: { error() {}, log() {} }, ...globals }, { filename });
    return module.exports;
}

test('pedidos assistidos, InfinitePay e venda rápida com PostgreSQL e provedor isolados', async t => {
    process.env.APP_URL = 'https://catalogo.example.test';
    process.env.INFINITEPAY_HANDLE = 'davini-vinhos-finos';
    process.env.INFINITEPAY_API_KEY = 'inchk_chave_apenas_testes';
    const db = new PGlite(); t.after(() => db.close());
    const schema = fs.readFileSync(path.join(root, 'database/schema.postgresql.sql'), 'utf8').split('-- Pagamentos InfinitePay')[0];
    await db.exec(schema);
    await db.exec(`INSERT INTO usuarios (id,nome_completo,email,telefone,senha,is_admin,is_vip,vip_tipo) VALUES
        (1,'Admin','admin@example.test','62999999999','hash',TRUE,TRUE,'admin'),
        (2,'Cliente VIP','vip@example.test','62988888888','hash',FALSE,TRUE,'cliente'),
        (3,'Cliente comum','comum@example.test','62977777777','hash',FALSE,FALSE,NULL);
        INSERT INTO beneficios_vip (nome,slug,tipo_desconto,valor_desconto) VALUES
        ('Admin','admin','percentual',50),('Cliente','cliente','percentual',10);
        INSERT INTO vinhos (id,nome,tipo,uva,preco,ativo) VALUES
        (1,'Merlot','tinto','Merlot',100,TRUE),(2,'Oculto','tinto','Merlot',100,FALSE);
        SELECT setval(pg_get_serial_sequence('usuarios','id'),3);
        INSERT INTO pedidos (usuario_id,total) VALUES (2,180);
        INSERT INTO pedidos_itens (pedido_id,vinho_id,vinho_nome,quantidade,preco_unitario,subtotal) VALUES (1,1,'Merlot',2,90,180);`);
    const migration = fs.readFileSync(path.join(root, 'database/migrations/20261120_pagamentos_infinitepay.sql'), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const descontosMigration = fs.readFileSync(path.join(root, 'database/migrations/20261120_venda_descontos.sql'), 'utf8');
    await db.exec(descontosMigration); await db.exec(descontosMigration);
    const tentativasMigration = fs.readFileSync(path.join(root, 'database/migrations/20261120_troca_pagamento_tap.sql'), 'utf8');
    await db.exec(tentativasMigration); await db.exec(tentativasMigration);
    assert.equal((await db.query('SELECT total, frete FROM pedidos WHERE id = 1')).rows[0].total, '180.00');
    let tail = Promise.resolve();
    const pool = { async query(sql, params) { await tail; return db.query(sql, params); }, async connect() {
        const anterior = tail; let release; tail = new Promise(resolve => { release = resolve; }); await anterior;
        return { query: (sql, params) => db.query(sql, params), release };
    } };
    const chamadas = [], emails = [];
    let modo = 'ok', retorno = { success: true, paid: true, amount: 19500, paid_amount: 19700 };
    let falhaProvedor = null;
    const provedor = async (url, options) => {
        chamadas.push({ url, headers: options.headers, payload: JSON.parse(options.body) });
        if (falhaProvedor) return { ok: false, status: falhaProvedor.status, json: async () => falhaProvedor.body };
        if (modo === 'falha') throw new Error('Não expor inchk_segredo');
        if (url.endsWith('/links')) return { ok: true, json: async () => ({ checkout_url: 'https://checkout.infinitepay.io/davini/teste' }) };
        return { ok: true, json: async () => retorno };
    };
    const secret = 'pagamentos-apenas-testes';
    const sessoes = { 1: randomUUID(), 2: randomUUID(), 3: randomUUID() };
    for (const [user, id] of Object.entries(sessoes)) await db.query("INSERT INTO sessoes_usuario (id,usuario_id,expira_em) VALUES ($1,$2,CURRENT_TIMESTAMP + INTERVAL '1 day')", [id, Number(user)]);
    const auth = modulo('middleware/auth.js', { '../config/database': { pool } }, { process: { env: { JWT_SECRET: secret } } });
    const router = modulo('routes/pagamentos.js', { '../config/database': { pool }, '../middleware/auth': auth,
        '../services/pedidoEmailService': { notificarPedido: async (...args) => emails.push(args.slice(1)) },
        '../services/infinitepayService': { ...service,
            gerarCheckout: (pool, id) => service.gerarCheckout(pool, id, provedor),
            trocarFormaPagamento: (pool, id, dados, admin) => service.trocarFormaPagamento(pool, id, dados, admin, provedor),
            confirmar: (pool, id, dados) => service.confirmar(pool, id, dados, provedor) } });
    const vendas = modulo('routes/vendas-rapidas.js', { '../config/database': { pool }, '../middleware/auth': auth });
    const app = express(); app.use(express.json()); app.use('/pagamentos', router); app.use('/vendas', vendas);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const request = async (rota, { user = 1, method = 'GET', body } = {}) => {
        const headers = { 'Content-Type': 'application/json' };
        if (user) headers.Authorization = 'Bearer ' + jwt.sign({ id: user }, secret, { expiresIn: '1h', jwtid: sessoes[user] });
        const res = await fetch(`http://127.0.0.1:${server.address().port}${rota}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: res.status, body: await res.json(), cache: res.headers.get('cache-control') };
    };
    const entrega = { frete: '15.00', entrega_tipo: 'entrega', entrega_detalhes: 'Rua Teste, 123. Entrega na sexta-feira.' };
    const novaVenda = (extra = {}) => ({ chave_criacao: randomUUID(), cliente_id: 2, itens: [{ id: 1, quantidade: 2 }], ...extra });
    let pagamento;
    await t.test('rotas de cobrança e venda exigem administrador atual, sem vazar configuração', async () => {
        for (const user of [null, 2]) {
            for (const [rota, method, body] of [
                ['/pagamentos/config', 'GET'], ['/pagamentos/pedidos/1', 'GET'],
                ['/pagamentos/pedidos/1/entrega', 'PUT', entrega], ['/pagamentos/pedidos/1/checkout', 'POST', {}],
                ['/pagamentos/pedidos/1/tap', 'POST', { payment_method: 'credit', installments: 1 }],
                ['/vendas/opcoes', 'GET'], ['/vendas', 'POST', novaVenda()]
            ]) assert.equal((await request(rota, { user, method, body })).status, user ? 403 : 401);
        }
        const config = await request('/pagamentos/config');
        assert.equal(config.cache, 'private, no-store');
        assert.equal(config.body.handle, 'davini-vinhos-finos');
        assert.doesNotMatch(JSON.stringify(config), /inchk_/);
    });
    await t.test('pedido aguarda frete, inclusive zero explícito para retirada', async () => {
        assert.equal((await request('/pagamentos/pedidos/1/checkout', { method: 'POST', body: {} })).status, 409);
        for (const dados of [{ ...entrega, frete: -1 }, { ...entrega, frete: '1.001' }, { ...entrega, entrega_tipo: 'retirada' }, { ...entrega, entrega_detalhes: '' }]) {
            assert.equal((await request('/pagamentos/pedidos/1/entrega', { method: 'PUT', body: dados })).status, 400);
        }
        const res = await request('/pagamentos/pedidos/1/entrega', { method: 'PUT', body: entrega });
        assert.equal(res.status, 200); assert.equal(res.body.total, '195.00');
        await request('/pagamentos/pedidos/1/entrega', { method: 'PUT', body: entrega });
        assert.equal((await db.query('SELECT total FROM pedidos WHERE id = 1')).rows[0].total, '195.00', 'frete não acumula');
        assert.equal(chamadas.length, 0);
    });
    await t.test('checkout usa itens gravados, frete em centavos, uso único e retorno fixo', async () => {
        const res = await request('/pagamentos/pedidos/1/checkout', { method: 'POST', body: { total: 1, url: 'https://atacante.test' } });
        assert.equal(res.status, 200); pagamento = res.body.id;
        const call = chamadas[0];
        assert.deepEqual(call.payload.items, [{ description: 'Merlot', quantity: 2, price: 9000 }, { description: 'Frete / entrega', quantity: 1, price: 1500 }]);
        assert.equal(call.payload.order_nsu, pagamento);
        assert.equal(call.payload.options.single_payment, true);
        assert.match(call.payload.redirect_url, /^https:\/\/catalogo.example.test\/pagamento-retorno.html/);
        assert.equal(call.headers['X-Api-Key'], process.env.INFINITEPAY_API_KEY);
        assert.doesNotMatch(JSON.stringify(res), /inchk_|payload|email/);
        await request('/pagamentos/pedidos/1/checkout', { method: 'POST', body: {} });
        assert.equal(chamadas.filter(c => c.url.endsWith('/links')).length, 1);
        assert.equal((await request('/pagamentos/pedidos/1/entrega', { method: 'PUT', body: { ...entrega, frete: 0 } })).status, 409);
    });
    await t.test('retorno forjado, referência trocada ou valor divergente não confirma pedido', async () => {
        assert.equal((await request('/pagamentos/confirmar', { user: null, method: 'POST', body: { pagamento_id: pagamento, pago: true } })).status, 400);
        const dados = { pagamento_id: pagamento, order_nsu: pagamento, transaction_nsu: randomUUID(), slug: 'fatura123' };
        const consultar = () => request('/pagamentos/confirmar', { user: null, method: 'POST', body: dados });
        retorno = { success: false, paid: true, amount: 19500 };
        assert.equal((await consultar()).body.pago, false);
        retorno = { success: true, paid: true, amount: 1 };
        assert.equal((await consultar()).status, 409);
        assert.equal((await db.query('SELECT status FROM pedidos WHERE id = 1')).rows[0].status, 'aguardando_pagamento');
        assert.equal(emails.length, 0);
    });
    await t.test('webhook consulta a API e confirma uma só vez, sem comparar taxas com valor original', async () => {
        const dados = { order_nsu: pagamento, transaction_nsu: randomUUID(), invoice_slug: 'fatura123', amount: 1 };
        retorno = { success: true, paid: true, amount: 19500, paid_amount: 19700 };
        const consultar = () => request(`/pagamentos/webhook/${pagamento}`, { user: null, method: 'POST', body: dados });
        assert.equal((await consultar()).body.pago, true);
        assert.equal((await consultar()).body.pago, true);
        assert.equal((await db.query('SELECT status FROM pedidos WHERE id = 1')).rows[0].status, 'confirmado');
        assert.equal((await db.query('SELECT confirmacao FROM pagamentos WHERE id = $1', [pagamento])).rows[0].confirmacao, 'api');
        assert.equal(emails.length, 1);
        assert.equal((await request('/pagamentos/pedidos/1/checkout', { method: 'POST', body: {} })).status, 409);
        assert.equal((await request('/pagamentos/confirmar', { user: null, method: 'POST', body: { pagamento_id: pagamento, ...dados, slug: 'outra', transaction_nsu: randomUUID() } })).status, 400);
    });
    await t.test('venda rápida usa o VIP do cliente, não do administrador, e reenvio não duplica', async () => {
        const dados = novaVenda();
        const primeira = await request('/vendas', { method: 'POST', body: dados });
        assert.equal(primeira.status, 201); assert.equal(primeira.body.total, 180);
        const segunda = await request('/vendas', { method: 'POST', body: dados });
        assert.equal(segunda.body.pedidoId, primeira.body.pedidoId);
        const p = (await db.query('SELECT * FROM pedidos WHERE id = $1', [primeira.body.pedidoId])).rows[0];
        assert.equal(p.usuario_id, 2); assert.equal(p.vendedor_id, 1); assert.equal(p.origem, 'presencial'); assert.equal(p.frete, '0.00');
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM pedidos WHERE chave_criacao = $1', [dados.chave_criacao])).rows[0].n, 1);
        for (const extra of [{ cliente_id: 1 }, { itens: [{ id: 2, quantidade: 1 }] }, { itens: [{ id: 1, quantidade: -1 }] }]) {
            assert.ok((await request('/vendas', { method: 'POST', body: novaVenda(extra) })).status >= 400);
        }
    });
    await t.test('prévia aplica VIP e desconto antes de registrar, sem criar cliente ou pedido', async () => {
        const antes = (await db.query('SELECT COUNT(*)::int AS n FROM pedidos')).rows[0].n;
        const dados = { cliente_id: 2, itens: [{ id: 1, quantidade: 2 }], desconto: { tipo: 'percentual', valor: '10' } };
        const previa = await request('/vendas/simular', { method: 'POST', body: dados });
        assert.equal(previa.status, 200); assert.equal(previa.body.itens[0].preco, 90);
        assert.equal(previa.body.subtotal, 180); assert.equal(previa.body.desconto_manual, 18); assert.equal(previa.body.total, 162);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM pedidos')).rows[0].n, antes);
        const novo = await request('/vendas/simular', { method: 'POST', body: { ...dados, cliente_id: undefined, novo_cliente: true } });
        assert.equal(novo.body.total, 180, 'Novo cliente não herda o VIP do vendedor');
        for (const desconto of [{ tipo: 'percentual', valor: 101 }, { tipo: 'valor', valor: 181 }, { tipo: 'valor', valor: -1 }, { tipo: 'valor', valor: '1.001' }]) {
            assert.equal((await request('/vendas/simular', { method: 'POST', body: { ...dados, desconto } })).status, 400);
        }
        assert.equal((await request('/vendas/simular', { user: 2, method: 'POST', body: dados })).status, 403);
    });
    await t.test('valor previsto divergente não grava venda; desconto salvo permanece ao adicionar frete e gerar checkout', async () => {
        const dados = novaVenda({ desconto: { tipo: 'valor', valor: '10.01' }, total_previsto: '169.99' });
        assert.equal((await request('/vendas', { method: 'POST', body: { ...dados, total_previsto: '1.00' } })).status, 409);
        assert.equal((await db.query('SELECT id FROM pedidos WHERE chave_criacao = $1', [dados.chave_criacao])).rows.length, 0);
        const venda = await request('/vendas', { method: 'POST', body: dados });
        assert.equal(venda.status, 201); assert.equal(venda.body.total, 169.99);
        const id = venda.body.pedidoId;
        const atualizado = await request(`/pagamentos/pedidos/${id}/entrega`, { method: 'PUT', body: entrega });
        assert.equal(atualizado.body.total, '184.99'); assert.equal(atualizado.body.desconto_manual, '10.01');
        assert.equal((await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} })).status, 200);
        const payload = chamadas.at(-1).payload;
        assert.equal(payload.items.reduce((s, i) => s + i.quantity * i.price, 0), 18499);
        assert.equal(payload.items.filter(i => i.description === 'Merlot').reduce((s, i) => s + i.quantity, 0), 2);
        assert.deepEqual(payload.options.payment_methods_enabled, ['credit_card', 'pix']);
        assert.equal('assured_installments' in payload.options, false, 'Regras de taxas da conta preservadas');
        assert.equal('discounts' in payload.options, false, 'Descontos por meio de pagamento são definidos na conta');
    });
    await t.test('pré-cadastro protege senha e não duplica e-mail ou cliente em reenvio', async () => {
        const dados = novaVenda({ cliente_id: undefined, cliente: { nome_completo: 'Cliente novo', telefone: '(62)99999-9999', email: 'novo@example.test' } });
        const res = await request('/vendas', { method: 'POST', body: dados }); assert.equal(res.status, 201); assert.equal(res.body.total, 200);
        assert.equal((await request('/vendas', { method: 'POST', body: dados })).body.pedidoId, res.body.pedidoId);
        const u = (await db.query("SELECT * FROM usuarios WHERE email = 'novo@example.test'")).rows[0];
        assert.match(u.senha, /^\$2[aby]\$12\$/); assert.equal(u.is_admin, false); assert.equal(u.is_vip, false);
        assert.equal((await request('/vendas', { method: 'POST', body: { ...dados, chave_criacao: randomUUID() } })).status, 409);
    });
    await t.test('falha de emissão preserva payload e chave para recuperar a mesma cobrança', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() });
        const id = venda.body.pedidoId; modo = 'falha';
        const falha = await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} });
        assert.equal(falha.status, 502); assert.doesNotMatch(JSON.stringify(falha), /inchk_/);
        const antes = chamadas.at(-1).payload;
        assert.equal((await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} })).status, 409);
        await db.query("UPDATE pagamentos SET tentativa_em = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE pedido_id = $1", [id]);
        modo = 'ok';
        assert.equal((await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} })).status, 200);
        assert.deepEqual(chamadas.at(-1).payload, antes);
    });
    await t.test('emissão concorrente, troca de método e link expirado não criam cobranças extras', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const antes = chamadas.filter(c => c.url.endsWith('/links')).length;
        const resultados = await Promise.all([1, 2, 3].map(() => request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} })));
        assert.ok(resultados.some(r => r.status === 200));
        assert.ok(resultados.every(r => [200,409].includes(r.status)));
        assert.equal(chamadas.filter(c => c.url.endsWith('/links')).length, antes + 1);
        assert.equal((await request(`/pagamentos/pedidos/${id}/tap`, { method: 'POST', body: { payment_method: 'credit', installments: 1 } })).status, 409);
        await db.query("UPDATE pagamentos SET expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE pedido_id = $1", [id]);
        assert.equal((await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} })).status, 409);
        assert.equal(chamadas.filter(c => c.url.endsWith('/links')).length, antes + 1);
    });
    await t.test('e-mail do pré-cadastro segue a mesma normalização do login e telefone segue formato do cadastro', async () => {
        const dados = novaVenda({ cliente_id: undefined, cliente: { nome_completo: 'Cliente Gmail', telefone: '62999999999', email: 'Nome.Sobrenome+loja@gmail.com' } });
        assert.equal((await request('/vendas', { method: 'POST', body: dados })).status, 201);
        const u = (await db.query("SELECT email, telefone FROM usuarios WHERE email = 'nomesobrenome@gmail.com'")).rows[0];
        assert.ok(u); assert.equal(u.telefone, '(62)99999-9999');
    });
    await t.test('InfiniteTap transmite valor e pedido, mas não presume pagamento e exige conferência explícita', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const rota = `/pagamentos/pedidos/${id}/tap`;
        const res = await request(rota, { method: 'POST', body: { payment_method: 'credit', installments: 3 } });
        assert.equal(res.status, 200);
        const url = new URL(res.body.url);
        assert.equal(url.protocol, 'infinitepaydash:'); assert.equal(url.searchParams.get('amount'), '18000');
        assert.equal(url.searchParams.get('installments'), '3'); assert.equal(url.searchParams.get('order_id'), res.body.pagamento_id);
        assert.equal(url.searchParams.get('handle'), 'davini-vinhos-finos');
        assert.equal((await db.query('SELECT status FROM pagamentos WHERE pedido_id = $1', [id])).rows[0].status, 'pendente');
        assert.equal((await request(rota, { method: 'POST', body: { payment_method: 'debit', installments: 1 } })).status, 409);
        const reabrir = await request(rota, { method: 'POST', body: { payment_method: 'debit', installments: 1, reabrir_sem_pagamento: true } });
        assert.equal(reabrir.body.url, res.body.url, 'retoma a mesma modalidade e identificação');
        const nsu = randomUUID();
        assert.equal((await request(`${rota}/conferir`, { method: 'POST', body: { transaction_nsu: nsu, conferido: false } })).status, 400);
        assert.equal((await request(`${rota}/conferir`, { user: 2, method: 'POST', body: { transaction_nsu: nsu, conferido: true } })).status, 403);
        assert.equal((await request(`${rota}/conferir`, { method: 'POST', body: { transaction_nsu: nsu, pagamento_id: res.body.pagamento_id, conferido: true } })).status, 200);
        const p = (await db.query('SELECT * FROM pagamentos WHERE pedido_id = $1', [id])).rows[0];
        assert.equal(p.status, 'pago'); assert.equal(p.confirmacao, 'manual_admin'); assert.equal(p.confirmado_por, 1);
        assert.equal((await request(rota, { method: 'POST', body: { payment_method: 'credit', installments: 1, reabrir_sem_pagamento: true } })).status, 409);
    });
    await t.test('pagamento tardio de pedido cancelado fica registrado sem reabrir entrega', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const pg = await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} });
        await db.query("UPDATE pedidos SET status = 'cancelado' WHERE id = $1", [id]);
        retorno = { success: true, paid: true, amount: 18000 };
        const res = await request(`/pagamentos/webhook/${pg.body.id}`, { user: null, method: 'POST', body: {
            order_nsu: pg.body.id, transaction_nsu: randomUUID(), invoice_slug: 'cancelado' } });
        assert.equal(res.body.pago, true); assert.equal(res.body.revisao, true);
        assert.equal((await db.query('SELECT status FROM pedidos WHERE id = $1', [id])).rows[0].status, 'cancelado');
    });
    await t.test('pedido cancelado não permite confirmar recebimento manual, nem retomada do Tap', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        assert.equal((await request(`/pagamentos/pedidos/${id}/tap`, { method: 'POST', body: { payment_method: 'credit', installments: 2 } })).status, 200);
        await db.query("UPDATE pedidos SET status = 'cancelado' WHERE id = $1", [id]);
        const pg = (await db.query('SELECT id FROM pagamentos WHERE pedido_id = $1', [id])).rows[0];
        assert.equal((await request(`/pagamentos/pedidos/${id}/trocar`, { method: 'POST', body: { metodo: 'checkout', pagamento_anterior_id: pg.id, sem_pagamento: true } })).status, 409);
        assert.equal((await request(`/pagamentos/pedidos/${id}/tap/conferir`, { method: 'POST', body: { transaction_nsu: randomUUID(), pagamento_id: pg.id, conferido: true } })).status, 409);
        assert.equal((await db.query('SELECT status FROM pagamentos WHERE pedido_id = $1', [id])).rows[0].status, 'pendente');
        assert.equal((await request(`/pagamentos/pedidos/${id}/tap`, { method: 'POST', body: { payment_method: 'credit', installments: 2, reabrir_sem_pagamento: true } })).status, 409);
    });
    await t.test('débito sem aprovação pode mudar para crédito e depois checkout Pix, preservando histórico e valor', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const rota = `/pagamentos/pedidos/${id}`;
        const debito = await request(`${rota}/tap`, { method: 'POST', body: { payment_method: 'debit', installments: 1 } });
        const dados = { metodo: 'tap', payment_method: 'credit', installments: 3, pagamento_anterior_id: debito.body.pagamento_id, sem_pagamento: true };
        assert.equal((await request(`${rota}/trocar`, { method: 'POST', body: { ...dados, sem_pagamento: false } })).status, 400);
        assert.equal((await request(`${rota}/trocar`, { user: 2, method: 'POST', body: dados })).status, 403);
        const credito = await request(`${rota}/trocar`, { method: 'POST', body: dados });
        assert.equal(credito.status, 200); assert.equal(credito.body.metodo, 'tap');
        assert.notEqual(credito.body.pagamento_id, debito.body.pagamento_id);
        const url = new URL(credito.body.url);
        assert.equal(url.searchParams.get('payment_method'), 'credit'); assert.equal(url.searchParams.get('installments'), '3');
        assert.equal(url.searchParams.get('amount'), '18000');
        const antigo = (await db.query('SELECT * FROM pagamentos WHERE id = $1', [debito.body.pagamento_id])).rows[0];
        assert.equal(antigo.ativa, false); assert.equal(antigo.substituida_por, 1); assert.ok(antigo.substituida_em);
        assert.equal(antigo.payload.payment_method, 'debit');
        assert.equal((await request(`${rota}/tap/conferir`, { method: 'POST', body: { pagamento_id: antigo.id, transaction_nsu: randomUUID(), conferido: true } })).status, 409);
        const pix = await request(`${rota}/trocar`, { method: 'POST', body: { metodo: 'checkout', sem_pagamento: true, pagamento_anterior_id: credito.body.pagamento_id } });
        assert.equal(pix.status, 200); assert.equal(pix.body.metodo, 'checkout');
        assert.match(pix.body.url, /^https:\/\/checkout.infinitepay.io\//);
        const atual = await request(rota);
        assert.equal(atual.body.pagamento.id, pix.body.pagamento_id); assert.equal(atual.body.historico.length, 2);
        const payload = chamadas.at(-1).payload;
        assert.deepEqual(payload.options.payment_methods_enabled, ['credit_card', 'pix']);
        assert.equal(payload.items.reduce((s, i) => s + i.quantity * i.price, 0), 18000);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM pagamentos WHERE pedido_id = $1 AND ativa = TRUE', [id])).rows[0].n, 1);
        assert.equal((await request(`${rota}/trocar`, { method: 'POST', body: { ...dados, pagamento_anterior_id: pix.body.pagamento_id } })).status, 409, 'Checkout ativo não é substituído pois o link pode ser pago');
    });
    await t.test('trocas concorrentes e confirmações de telas antigas não criam duas tentativas ativas', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const rota = `/pagamentos/pedidos/${id}`;
        const tap = await request(`${rota}/tap`, { method: 'POST', body: { payment_method: 'debit', installments: 1 } });
        const body = { metodo: 'tap', payment_method: 'credit', installments: 2, sem_pagamento: true, pagamento_anterior_id: tap.body.pagamento_id };
        const respostas = await Promise.all([1, 2].map(() => request(`${rota}/trocar`, { method: 'POST', body })));
        assert.deepEqual(respostas.map(r => r.status).sort(), [200,409]);
        const atual = respostas.find(r => r.status === 200).body;
        const confirmar = await request(`${rota}/tap/conferir`, { method: 'POST', body: { pagamento_id: atual.pagamento_id, transaction_nsu: randomUUID(), conferido: true } });
        assert.equal(confirmar.status, 200);
        assert.equal((await request(`${rota}/trocar`, { method: 'POST', body: { ...body, pagamento_anterior_id: atual.pagamento_id } })).status, 409);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM pagamentos WHERE pedido_id = $1 AND ativa = TRUE', [id])).rows[0].n, 1);
    });
    await t.test('troca inválida faz rollback; erro externo preserva a nova cobrança para recuperação', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const rota = `/pagamentos/pedidos/${id}`;
        const tap = await request(`${rota}/tap`, { method: 'POST', body: { payment_method: 'debit', installments: 1 } });
        const dados = { metodo: 'checkout', pagamento_anterior_id: tap.body.pagamento_id, sem_pagamento: true };
        const chave = process.env.INFINITEPAY_API_KEY; delete process.env.INFINITEPAY_API_KEY;
        try { assert.equal((await request(`${rota}/trocar`, { method: 'POST', body: dados })).status, 503); }
        finally { process.env.INFINITEPAY_API_KEY = chave; }
        assert.equal((await request(rota)).body.pagamento.id, tap.body.pagamento_id);
        modo = 'falha';
        assert.equal((await request(`${rota}/trocar`, { method: 'POST', body: dados })).status, 502);
        modo = 'ok';
        const atual = (await request(rota)).body.pagamento;
        assert.equal(atual.metodo, 'checkout'); assert.equal(atual.status, 'gerando');
        await db.query("UPDATE pagamentos SET tentativa_em = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1", [atual.id]);
        const recuperado = await request(`${rota}/checkout`, { method: 'POST', body: {} });
        assert.equal(recuperado.status, 200); assert.equal(recuperado.body.id, atual.id);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM pagamentos WHERE pedido_id = $1', [id])).rows[0].n, 2);
    });
    await t.test('recusa do provedor identifica configuração ou dados sem expor corpo sensível nem mudar o payload', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        for (const [http, body, esperado, code] of [
            [403, { error: 'merchant mismatch', segredo: 'inchk_nao_expor' }, 503, 'INFINITEPAY_CREDENCIAL_RECUSADA'],
            [422, { code: 'external_checkout_not_enabled' }, 503, 'INFINITEPAY_CHECKOUT_DESATIVADO'],
            [422, { error: 'Dados de cliente inválidos', email: 'privado@example.test' }, 422, 'INFINITEPAY_DADOS_RECUSADOS'],
            [500, { error: 'Falha interna' }, 502, 'INFINITEPAY_INDISPONIVEL']
        ]) {
            await db.query("UPDATE pagamentos SET tentativa_em = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE pedido_id = $1", [id]);
            falhaProvedor = { status: http, body };
            const res = await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} });
            assert.equal(res.status, esperado); assert.equal(res.body.code, code);
            assert.doesNotMatch(JSON.stringify(res), /inchk_nao_expor|privado@example.test|merchant mismatch/);
        }
        falhaProvedor = null;
    });
    await t.test('chave ausente bloqueia emissão sem reservar cobrança, e parcelas têm mínimo por parcela', async () => {
        const venda = await request('/vendas', { method: 'POST', body: novaVenda() }); const id = venda.body.pedidoId;
        const key = process.env.INFINITEPAY_API_KEY; delete process.env.INFINITEPAY_API_KEY;
        try { assert.equal((await request(`/pagamentos/pedidos/${id}/checkout`, { method: 'POST', body: {} })).status, 503); }
        finally { process.env.INFINITEPAY_API_KEY = key; }
        assert.equal((await db.query('SELECT id FROM pagamentos WHERE pedido_id = $1', [id])).rows.length, 0);
        // R$1 total não pode ser dividido em duas parcelas.
        await db.query('UPDATE pedidos SET total = 1 WHERE id = $1', [id]);
        assert.equal((await request(`/pagamentos/pedidos/${id}/tap`, { method: 'POST', body: { payment_method: 'credit', installments: 2 } })).status, 400);
    });
});

test('links externos são aceitos somente no domínio oficial de checkout', () => {
    assert.equal(service.checkoutUrl('https://buy.infinitepay.io/loja/link'), 'https://buy.infinitepay.io/loja/link');
    assert.equal(service.checkoutUrl('https://checkout.infinitepay.io/loja/link'), 'https://checkout.infinitepay.io/loja/link');
    for (const url of [null, undefined, {}, 'javascript:alert(1)', 'http://buy.infinitepay.io',
        'https://buy.infinitepay.io.atacante.test', 'https://checkout.infinitepay.io.atacante.test',
        'https://user:senha@buy.infinitepay.io', 'https://checkout.infinitepay.io:8443/loja']) assert.throws(() => service.checkoutUrl(url));
});

test('emissão normaliza os formatos de link sem aceitar endereços externos ou respostas ambíguas', () => {
    const url = 'https://checkout.infinitepay.io/loja/fatura';
    for (const campo of ['checkout_url', 'link', 'url']) assert.equal(service.extrairCheckoutUrl({ [campo]: url }), url);
    assert.equal(service.extrairCheckoutUrl({ checkout_url: null, link: url }), url);
    assert.equal(service.extrairCheckoutUrl({ checkout_url: url, url }), url);
    for (const resposta of [{}, null, { checkout_url: 'javascript:alert(1)' }, { link: 'https://checkout.infinitepay.io.atacante.test' },
        { checkout_url: url, link: 'https://checkout.infinitepay.io/outra-fatura' }]) {
        assert.throws(() => service.extrairCheckoutUrl(resposta), error => error.statusCode === 502 && error.code === 'INFINITEPAY_LINK_INVALIDO');
    }
});

test('rateio de desconto preserva cada centavo e não cria preços negativos em quantidades indivisíveis', () => {
    const { itensCheckout } = require('../services/vendaService');
    const itens = [{ vinho_nome: 'A', quantidade: 3, preco_unitario: '1.01', subtotal: '3.03' },
        { vinho_nome: 'B', quantidade: 2, preco_unitario: '5.07', subtotal: '10.14' }];
    for (let desconto = 0; desconto <= 1317; desconto++) {
        const resultado = itensCheckout(itens, (desconto / 100).toFixed(2));
        assert.equal(resultado.reduce((s, i) => s + i.quantity * i.price, 0), 1317 - desconto);
        assert.ok(resultado.every(i => Number.isInteger(i.price) && i.price > 0 && Number.isInteger(i.quantity) && i.quantity > 0));
    }
});
