const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const jwt = require('jsonwebtoken');
const PedidoStatus = require('../js/pedido-status');

const root = path.join(__dirname, '..');
const secret = 'chave-exclusiva-dos-testes-de-status';
const quietConsole = { log() {}, error() {}, warn() {}, debug() {} };
const migration = 'database/migrations/20261110_status_pedidos.sql';

function estadosDoSql(filename) {
    const sql = fs.readFileSync(path.join(root, filename), 'utf8');
    const check = sql.match(/CHECK\s*\(\s*status\s+IN\s*\(([^)]+)\)/i);
    assert.ok(check, `Restrição de status não encontrada em ${filename}`);
    return [...check[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
}

const estadosBanco = new Set(estadosDoSql('database/schema.postgresql.sql'));

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

function pedido(status = 'pendente', id = 42) {
    return { id, usuario_id: 7, status, total: '100.00', created_at: '2026-11-10T12:00:00Z', itens: [] };
}

function criarApi(options = {}) {
    const pedidos = new Map((options.pedidos || [pedido()]).map(row => [row.id, structuredClone(row)]));
    const updates = [];
    const pool = {
        async query(sql, params) {
            if (sql.includes('FROM sessoes_usuario s')) {
                return { rows: [{ id: 7, email: 'admin@example.com', is_admin: options.admin !== false }] };
            }
            if (sql.startsWith('UPDATE pedidos SET status')) {
                updates.push({ sql, params });
                if (options.falharGravacao) throw new Error('Falha de banco simulada');
                if (!estadosBanco.has(params[0])) throw new Error('Status recusado pelo schema PostgreSQL');
                const row = pedidos.get(params[1]);
                if (!row) return { rows: [], rowCount: 0 };
                row.status = params[0];
                return { rows: [{ id: row.id, status: row.status }], rowCount: 1 };
            }
            if (sql.startsWith('SELECT * FROM pedidos WHERE usuario_id')) {
                return { rows: [...pedidos.values()].filter(row => row.usuario_id === Number(params[0])).map(row => ({ ...row })) };
            }
            if (sql.includes('FROM pedidos p')) return { rows: [...pedidos.values()].map(row => ({ ...row })) };
            if (sql.startsWith('SELECT * FROM pedidos_itens')) return { rows: [] };
            throw new Error(`Consulta inesperada: ${sql}`);
        }
    };
    const auth = carregarModulo('middleware/auth.js', { '../config/database': { pool } }, {
        process: { env: { JWT_SECRET: secret } }
    });
    const router = carregarModulo('routes/pedidos.js', {
        '../config/database': { pool }, '../middleware/auth': auth
    });
    const token = jwt.sign({ id: 7, isAdmin: true }, secret, {
        expiresIn: '7d', jwtid: '11111111-1111-4111-8111-111111111111'
    });

    async function request(method, url, body = {}, requestToken = token) {
        const req = {
            method, url, originalUrl: `/api/pedidos${url}`,
            headers: requestToken ? { authorization: `Bearer ${requestToken}` } : {},
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
    return { request, pedidos, updates, token };
}

function criarTelas(fetchImpl = async () => { throw new Error('Requisição inesperada'); }, options = {}) {
    const select = options.semSelect ? null : {
        value: 'pendente', disabled: false,
        dataset: { statusAtual: 'pendente' }, className: 'pedido-status-select status-pendente'
    };
    const mensagens = [];
    const context = {
        window: { authManager: { obterToken: () => 'token-simulado' } },
        document: {
            readyState: 'loading', addEventListener() {},
            querySelector: selector => selector.startsWith('.pedido-status-select[') ? select : null
        },
        console: quietConsole, API_URL: '/api', fetch: fetchImpl,
        localStorage: { getItem: () => null }
    };
    vm.createContext(context);
    for (const file of ['js/pedido-status.js', 'js/clientes.js', 'js/perfil.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    }
    vm.runInContext('this.PerfilManagerClasse = PerfilManager;', context);
    context.mostrarMensagem = (texto, tipo) => mensagens.push({ texto, tipo });
    const perfil = Object.create(context.PerfilManagerClasse.prototype);
    return { context, perfil, select, mensagens };
}

test('schema e migração aceitam exatamente os status compartilhados e os nomes legados', () => {
    const esperados = [...PedidoStatus.valores, ...Object.keys(PedidoStatus.aliases)].sort();
    assert.deepEqual([...estadosBanco].sort(), esperados);
    assert.deepEqual(estadosDoSql(migration).sort(), esperados);
});

test('as duas páginas carregam a definição compartilhada antes do código que renderiza pedidos', () => {
    for (const [htmlFile, consumer] of [['clientes.html', 'js/clientes.js'], ['meu-perfil.html', 'js/perfil.js']]) {
        const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
        const shared = html.indexOf('src="js/pedido-status.js"');
        assert.ok(shared >= 0 && shared < html.indexOf(`src="${consumer}"`), htmlFile);
    }
});

for (const status of PedidoStatus.valores) {
    test(`administrador pode gravar ${status} e consultar o mesmo status no histórico`, async () => {
        const api = criarApi();
        const result = await api.request('PUT', '/42/status', { status });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, status);
        assert.equal(result.body.pedidoId, 42);
        assert.equal(api.pedidos.get(42).status, status);
        const historico = await api.request('GET', '/cliente/7');
        assert.equal(historico.body[0].status, status);
    });
}

for (const [legado, atual] of [['processando', 'em_preparacao'], ['enviado', 'em_rota_entrega'], ['entregue', 'finalizado']]) {
    test(`leitura de ${legado} exibe ${atual} sem regravar pedido antigo`, async () => {
        const api = criarApi({ pedidos: [pedido(legado)] });
        for (const url of ['/cliente/7', '/']) {
            const result = await api.request('GET', url);
            assert.equal(result.status, 200);
            assert.equal(result.body[0].status, atual);
        }
        assert.equal(api.pedidos.get(42).status, legado);
        assert.equal(api.updates.length, 0);
        const telas = criarTelas();
        const admin = telas.context.renderizarPedido(pedido(legado));
        assert.match(admin, new RegExp(`<option value="${atual}" selected>`));
        const perfil = telas.perfil.renderizarPedido(pedido(legado));
        assert.ok(perfil.includes(`<span class="status-badge ${atual}">${PedidoStatus.obter(atual).label}</span>`));
    });

    test(`API aceita ${legado} de clientes antigos e grava ${atual}`, async () => {
        const api = criarApi();
        const result = await api.request('PUT', '/42/status', { status: legado });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, atual);
        assert.equal(api.pedidos.get(42).status, atual);
    });
}

test('status inválido ou com tipo incorreto não chega à gravação', async () => {
    const api = criarApi();
    for (const status of [undefined, null, 123, {}, [], ['cancelado'], '', 'inexistente', '<img onerror="alert(1)">']) {
        const result = await api.request('PUT', '/42/status', { status });
        assert.equal(result.status, 400, JSON.stringify(status));
    }
    assert.equal(api.updates.length, 0);
    assert.equal(api.pedidos.get(42).status, 'pendente');
});

test('API normaliza espaços e caixa de nomes conhecidos', async () => {
    const api = criarApi();
    const result = await api.request('PUT', '/42/status', { status: ' ENVIADO ' });
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'em_rota_entrega');
});

test('pedido inexistente retorna 404, sem informar sucesso nem alterar outro pedido', async () => {
    const api = criarApi();
    const result = await api.request('PUT', '/999/status', { status: 'cancelado' });
    assert.equal(result.status, 404);
    assert.equal(result.body.error, 'Pedido não encontrado');
    assert.equal(result.body.success, undefined);
    assert.equal(api.pedidos.get(42).status, 'pendente');
});

test('IDs inválidos são recusados antes da atualização', async () => {
    const api = criarApi();
    for (const id of ['abc', '0', '-1']) {
        assert.equal((await api.request('PUT', `/${id}/status`, { status: 'cancelado' })).status, 400);
    }
    assert.equal(api.updates.length, 0);
});

test('somente administradores autenticados podem alterar status', async () => {
    const api = criarApi({ admin: false });
    assert.equal((await api.request('PUT', '/42/status', { status: 'cancelado' })).status, 403);
    assert.equal((await api.request('PUT', '/42/status', { status: 'cancelado' }, null)).status, 401);
    assert.equal(api.updates.length, 0);
});

test('painel e perfil usam os mesmos rótulos em todos os status, incluindo Confirmado e Cancelado', () => {
    const telas = criarTelas();
    assert.deepEqual(Array.from(telas.context.window.PedidoStatus.valores), PedidoStatus.valores);
    for (const opcao of PedidoStatus.opcoes) {
        const admin = telas.context.renderizarPedido(pedido(opcao.valor));
        assert.match(admin, new RegExp(`<option value="${opcao.valor}" selected>`));
        assert.ok(admin.includes(opcao.label));
        assert.ok(telas.perfil.renderizarPedido(pedido(opcao.valor)).includes(
            `<span class="status-badge ${opcao.valor}">${opcao.label}</span>`
        ));
    }
});

test('status desconhecido não aparece como Pendente nem é inserido como HTML nas telas', () => {
    const telas = criarTelas();
    for (const status of [null, undefined, '<img src=x onerror="alert(1)">']) {
        const registro = { ...pedido(), status };
        const admin = telas.context.renderizarPedido(registro);
        const perfil = telas.perfil.renderizarPedido(registro);
        assert.ok(admin.includes('<option value="" disabled selected>Status não reconhecido</option>'));
        assert.ok(perfil.includes('status-badge desconhecido'));
        assert.ok(perfil.includes('Status não reconhecido'));
        assert.equal(admin.includes('onerror='), false);
        assert.equal(perfil.includes('onerror='), false);
    }
});

test('alteração no painel persiste pela API e aparece igual no perfil', async () => {
    const api = criarApi();
    const telas = criarTelas(async (url, options) => {
        assert.equal(url, '/api/pedidos/42/status');
        const result = await api.request(options.method, '/42/status', JSON.parse(options.body));
        return { ok: result.status === 200, json: async () => result.body };
    });
    telas.select.value = 'em_preparacao';
    assert.equal(await telas.context.alterarStatusPedido(42, 'em_preparacao'), true);
    assert.equal(telas.select.dataset.statusAtual, 'em_preparacao');
    assert.equal(telas.select.className, 'pedido-status-select status-preparacao');
    assert.equal(telas.select.disabled, false);
    assert.deepEqual(telas.mensagens.map(mensagem => mensagem.tipo), ['sucesso']);
    const historico = await api.request('GET', '/cliente/7');
    assert.ok(telas.perfil.renderizarPedido(historico.body[0]).includes('Em Preparação'));
});

test('falha de banco restaura seleção e cor anteriores e não mostra sucesso', async () => {
    const api = criarApi({ falharGravacao: true });
    const telas = criarTelas(async (url, options) => {
        const result = await api.request('PUT', '/42/status', JSON.parse(options.body));
        return { ok: result.status === 200, json: async () => result.body };
    });
    telas.select.value = 'cancelado';
    assert.equal(await telas.context.alterarStatusPedido(42, 'cancelado'), false);
    assert.equal(telas.select.value, 'pendente');
    assert.equal(telas.select.dataset.statusAtual, 'pendente');
    assert.equal(telas.select.className, 'pedido-status-select status-pendente');
    assert.equal(telas.select.disabled, false);
    assert.deepEqual(telas.mensagens.map(mensagem => mensagem.tipo), ['erro']);
    assert.equal(api.pedidos.get(42).status, 'pendente');
});

test('falha de rede mantém o status anterior e permite nova tentativa', async () => {
    const telas = criarTelas(async () => { throw new Error('Sem conexão'); });
    telas.select.dataset.statusAtual = 'em_preparacao';
    telas.select.value = 'finalizado';
    assert.equal(await telas.context.alterarStatusPedido(42, 'finalizado'), false);
    assert.equal(telas.select.value, 'em_preparacao');
    assert.equal(telas.select.className, 'pedido-status-select status-preparacao');
    assert.equal(telas.select.disabled, false);
});

test('nova alteração durante envio não dispara duas atualizações', async () => {
    let concluir;
    let chamadas = 0;
    const telas = criarTelas(() => {
        chamadas++;
        return new Promise(resolve => { concluir = resolve; });
    });
    const primeira = telas.context.alterarStatusPedido(42, 'finalizado');
    await telas.context.alterarStatusPedido(42, 'cancelado');
    assert.equal(telas.select.disabled, true);
    assert.equal(chamadas, 1);
    assert.equal(telas.mensagens.length, 0);
    concluir({ ok: true, json: async () => ({ status: 'finalizado', success: true }) });
    await primeira;
    assert.equal(telas.select.value, 'finalizado');
    assert.equal(telas.select.disabled, false);
});

test('fechar o modal durante a operação não transforma gravação bem-sucedida em erro', async () => {
    const telas = criarTelas(async () => ({ ok: true, json: async () => ({ status: 'cancelado', success: true }) }), { semSelect: true });
    assert.equal(await telas.context.alterarStatusPedido(42, 'cancelado'), true);
    assert.deepEqual(telas.mensagens.map(mensagem => mensagem.tipo), ['sucesso']);
});
