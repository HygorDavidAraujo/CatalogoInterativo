const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const jwt = require('jsonwebtoken');

const root = path.join(__dirname, '..');
const secret = 'chave-exclusiva-dos-testes-sem-acesso-a-servicos';
const quietConsole = { log() {}, error() {} };

function carregarModulo(relativePath, overrides = {}, globals = {}) {
    const filename = path.join(root, relativePath);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module,
        exports: module.exports,
        require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name),
        console: quietConsole,
        ...globals
    }, { filename });
    return module.exports;
}

function criarBanco(options = {}) {
    const queries = [];
    const usuario = options.usuario === undefined
        ? { id: 7, is_vip: false, vip_tipo: null }
        : options.usuario;
    const vinhos = options.vinhos || [
        { id: 1, nome: 'Merlot do banco', tipo: 'tinto', preco: '100.00', ativo: true },
        { id: 2, nome: 'Suco do banco', tipo: 'suco_integral_tinto', preco: '12.35', ativo: true }
    ];
    const client = {
        released: false,
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.startsWith('SELECT id, is_vip')) return { rows: usuario ? [usuario] : [] };
            if (sql.startsWith('SELECT id, nome')) {
                return { rows: vinhos.filter(vinho => params[0].includes(vinho.id)) };
            }
            if (sql.startsWith('SELECT tipo_desconto')) {
                return { rows: options.beneficio ? [options.beneficio] : [] };
            }
            if (sql.startsWith('INSERT INTO pedidos (')) return { rows: [{ id: 42 }] };
            if (sql.startsWith('INSERT INTO pedidos_itens') && options.falharItem) {
                throw new Error('Falha simulada na gravação de um item');
            }
            return { rows: [] };
        },
        release() { this.released = true; }
    };
    return { queries, client, pool: {
        async connect() { return client; },
        async query() {
            return { rows: usuario ? [{ id: 7, email: 'cliente@example.com', is_admin: false }] : [] };
        }
    } };
}

async function enviarPedido(body, options = {}) {
    const banco = criarBanco(options);
    const auth = carregarModulo('middleware/auth.js', {
        '../config/database': { pool: banco.pool }
    }, { process: { env: { JWT_SECRET: secret } } });
    const router = carregarModulo('routes/pedidos.js', {
        '../config/database': { pool: banco.pool },
        '../middleware/auth': auth
    });
    const token = options.semToken ? null : jwt.sign({ id: 7, isAdmin: false }, secret, {
        jwtid: '11111111-1111-4111-8111-111111111111'
    });
    const req = {
        method: 'POST', url: '/', originalUrl: '/api/pedidos',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: structuredClone(body), params: {}, query: {}
    };
    const response = await new Promise((resolve, reject) => {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(data) { resolve({ status: this.statusCode, body: data }); }
        };
        router.handle(req, res, error => reject(error || new Error('Rota não encontrada')));
    });
    // Normaliza objetos criados no contexto VM para comparações de protótipos.
    return {
        ...JSON.parse(JSON.stringify(response)),
        ...banco,
        queries: JSON.parse(JSON.stringify(banco.queries))
    };
}

test('pedido usa nome, preço e total do banco mesmo com valores adulterados no formato antigo', async () => {
    const result = await enviarPedido({
        usuario_id: 7, total: 0.01, is_vip: true, vip_tipo: 'diamante',
        itens: [{ id: 1, quantidade: 2, nome: 'Nome adulterado', preco: 0.01 }]
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.pedidoId, 42);
    assert.equal(result.body.total, 200);
    assert.equal(result.body.itens[0].nome, 'Merlot do banco');
    assert.equal(result.body.itens[0].preco, 100);
    assert.equal(result.body.itens[0].subtotal, 200);
    assert.deepEqual(result.queries.find(q => q.sql.startsWith('INSERT INTO pedidos (')).params, [7, 200, null]);
    assert.deepEqual(result.queries.find(q => q.sql.startsWith('INSERT INTO pedidos_itens')).params,
        [42, 1, 'Merlot do banco', 2, 100, 200]);
    assert.equal(result.queries.at(-1).sql, 'COMMIT');
    assert.equal(result.client.released, true);
});

test('aceita apenas IDs e quantidades e soma centavos sem erro de ponto flutuante', async () => {
    const result = await enviarPedido({ itens: [{ id: '1', quantidade: '3' }, { id: 2, quantidade: 1 }] }, {
        vinhos: [
            { id: 1, nome: 'A', tipo: 'tinto', preco: '0.10', ativo: true },
            { id: 2, nome: 'B', tipo: 'branco', preco: '0.20', ativo: null }
        ]
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.total, 0.5);
    assert.equal(result.body.itens[0].subtotal, 0.3);
});

for (const [tipo, valor, esperado] of [['percentual', '7.00', 93.9], ['valor_fixo', '12.35', 87.9]]) {
    test(`VIP ${tipo} usa benefício do banco e preserva arredondamento atual`, async () => {
        const result = await enviarPedido({ itens: [{ id: 1, quantidade: 2 }] }, {
            usuario: { id: 7, is_vip: true, vip_tipo: 'personalizado' },
            beneficio: { tipo_desconto: tipo, valor_desconto: valor }
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.itens[0].preco, esperado);
        assert.equal(result.body.total, esperado * 2);
    });
}

test('benefício ausente ou desativado não aplica descontos de fallback', async () => {
    const result = await enviarPedido({ itens: [{ id: 1, quantidade: 1 }] }, {
        usuario: { id: 7, is_vip: true, vip_tipo: 'ouro' }
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.total, 100);
    assert.match(result.queries.find(q => q.sql.startsWith('SELECT tipo_desconto')).sql, /ativo = TRUE/);
});

test('agrupa IDs repetidos sem perder quantidades', async () => {
    const result = await enviarPedido({ itens: [{ id: 1, quantidade: 2 }, { id: 1, quantidade: 3 }] });
    assert.equal(result.status, 201);
    assert.equal(result.body.total, 500);
    assert.equal(result.body.itens.length, 1);
    assert.equal(result.body.itens[0].quantidade, 5);
});

for (const [nome, options] of [
    ['produto removido', { vinhos: [] }],
    ['produto oculto', { vinhos: [{ id: 1, nome: 'Oculto', preco: '100.00', ativo: false }] }],
    ['preço inválido no banco', { vinhos: [{ id: 1, nome: 'Inválido', preco: '-1.00', ativo: true }] }]
]) {
    test(`${nome} cancela a transação sem gravar pedidos`, async () => {
        const result = await enviarPedido({ itens: [{ id: 1, quantidade: 1 }] }, options);
        assert.equal(result.status, 409);
        assert.equal(result.queries.some(q => q.sql.startsWith('INSERT')), false);
        assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
        assert.equal(result.client.released, true);
    });
}

for (const [nome, body] of [
    ['carrinho vazio', { itens: [] }],
    ['quantidade zero', { itens: [{ id: 1, quantidade: 0 }] }],
    ['quantidade fracionada', { itens: [{ id: 1, quantidade: 1.5 }] }],
    ['quantidade negativa', { itens: [{ id: 1, quantidade: -1 }] }],
    ['ID inválido', { itens: [{ id: 'abc', quantidade: 1 }] }],
    ['ID acima do limite PostgreSQL', { itens: [{ id: 2147483648, quantidade: 1 }] }]
]) {
    test(`${nome} é recusado pela validação antes de iniciar a transação`, async () => {
        const result = await enviarPedido(body);
        assert.equal(result.status, 400);
        assert.equal(result.queries.length, 0);
    });
}

test('limita quantidade acumulada de IDs repetidos', async () => {
    const result = await enviarPedido({ itens: [{ id: 1, quantidade: 999 }, { id: 1, quantidade: 1 }] });
    assert.equal(result.status, 400);
    assert.equal(result.queries.some(q => q.sql.startsWith('INSERT')), false);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
});

test('total acima do limite NUMERIC(10,2) é recusado antes da gravação', async () => {
    const result = await enviarPedido({ itens: [{ id: 1, quantidade: 999 }] }, {
        vinhos: [{ id: 1, nome: 'Caro', tipo: 'tinto', preco: '999999.99', ativo: true }]
    });
    assert.equal(result.status, 400);
    assert.equal(result.queries.some(q => q.sql.startsWith('INSERT')), false);
});

test('continua exigindo autenticação e impede pedidos para outra conta', async () => {
    const semToken = await enviarPedido({ itens: [{ id: 1, quantidade: 1 }] }, { semToken: true });
    const outraConta = await enviarPedido({ usuario_id: 8, itens: [{ id: 1, quantidade: 1 }] });
    assert.equal(semToken.status, 401);
    assert.equal(outraConta.status, 403);
    assert.equal(semToken.queries.length + outraConta.queries.length, 0);
});

test('conta removida é recusada sem iniciar a transação', async () => {
    const result = await enviarPedido({ itens: [{ id: 1, quantidade: 1 }] }, { usuario: null });
    assert.equal(result.status, 401);
    assert.equal(result.queries.length, 0);
    assert.equal(result.client.released, false);
});

test('falha ao gravar item faz rollback e libera conexão', async () => {
    const result = await enviarPedido({ itens: [{ id: 1, quantidade: 1 }] }, { falharItem: true });
    assert.equal(result.status, 500);
    assert.equal(result.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(result.queries.some(q => q.sql === 'COMMIT'), false);
    assert.equal(result.client.released, true);
});

function criarCarrinho(fetchImpl) {
    const source = fs.readFileSync(path.join(root, 'js/carrinho.js'), 'utf8').split('// Instância global')[0];
    const btn = { disabled: false };
    const aberturas = [];
    const mensagens = [];
    const authManager = { isLogado: () => true, obterToken: () => 'token', usuarioLogado: { id: 7, nome: 'Cliente', email: 'cliente@example.com' } };
    const context = {
        window: { authManager, open: url => aberturas.push(url) }, authManager,
        API_URL: '/api', fetch: fetchImpl, console: quietConsole,
        document: { getElementById: () => btn },
        vinhoManager: { async carregarConfiguracoes() {}, configuracoes: { whatsapp: '5511999999999' } }
    };
    vm.createContext(context);
    vm.runInContext(source + '\nthis.CarrinhoManager = CarrinhoManager;', context);
    const carrinho = Object.create(context.CarrinhoManager.prototype);
    carrinho.itens = [{ id: 1, quantidade: 2, preco: 0.01, nome: 'Nome desatualizado' }];
    carrinho.salvarCarrinho = () => {};
    carrinho.fecharCarrinho = () => {};
    carrinho.mostrarMensagem = (texto, tipo) => mensagens.push({ texto, tipo });
    return { carrinho, btn, aberturas, mensagens };
}

test('WhatsApp usa os mesmos nomes, preços e total confirmados pela API', async () => {
    let enviado;
    const state = criarCarrinho(async (url, options) => {
        enviado = JSON.parse(options.body);
        const result = await enviarPedido(enviado);
        return { ok: result.status === 201, json: async () => result.body };
    });
    await state.carrinho.finalizarPedido();
    assert.deepEqual(enviado.itens, [{ id: 1, quantidade: 2 }]);
    assert.equal('total' in enviado, false);
    const mensagem = new URL(state.aberturas[0]).searchParams.get('text');
    assert.match(mensagem, /Merlot do banco/);
    assert.match(mensagem, /Preço Unit: R\$ 100,00/);
    assert.match(mensagem, /TOTAL: R\$ 200,00/);
    assert.doesNotMatch(mensagem, /Nome desatualizado/);
    assert.equal(state.carrinho.itens.length, 0);
    assert.equal(state.btn.disabled, false);
});

test('produto recusado mantém o carrinho, mostra o erro e libera nova tentativa', async () => {
    const state = criarCarrinho(async () => ({ ok: false, json: async () => ({ error: 'Produto indisponível.' }) }));
    await state.carrinho.finalizarPedido();
    assert.equal(state.carrinho.itens.length, 1);
    assert.equal(state.aberturas.length, 0);
    assert.equal(state.mensagens[0].texto, 'Produto indisponível.');
    assert.equal(state.carrinho.finalizandoPedido, false);
    assert.equal(state.btn.disabled, false);
});

test('duplo clique durante envio não cria duas requisições', async () => {
    let concluir;
    let chamadas = 0;
    const state = criarCarrinho(() => {
        chamadas++;
        return new Promise(resolve => { concluir = resolve; });
    });
    const primeira = state.carrinho.finalizarPedido();
    await state.carrinho.finalizarPedido();
    assert.equal(chamadas, 1);
    assert.equal(state.btn.disabled, true);
    concluir({ ok: false, json: async () => ({ error: 'Tente novamente.' }) });
    await primeira;
    assert.equal(state.btn.disabled, false);
});
