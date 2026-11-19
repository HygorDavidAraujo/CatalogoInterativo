const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Precos = require('../js/precos');
const { calcularPedido } = require('../services/pedidoService');
const root = path.join(__dirname, '..');

const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/precos.js'), 'utf8'), browser);

for (const [preco, tipo, valor, esperado] of [
    ['100.00', null, null, 10000], ['100.00', 'percentual', '7.00', 9300],
    ['100.00', 'valor_fixo', '12.35', 8765], ['119.00', 'percentual', '7.00', 11067],
    ['10.50', 'percentual', '3.00', 1019], ['1.15', 'percentual', '10.00', 104],
    ['0.05', 'percentual', '10.00', 5], ['0.10', 'percentual', '33.33', 7],
    ['0.01', 'percentual', '100.00', 0], ['100.00', 'percentual', '0.00', 10000],
    ['100.00', 'valor_fixo', '0.00', 10000], ['100.00', 'valor_fixo', '150.00', 0]
]) {
    test(`preço ${preco}, benefício ${tipo} ${valor}: mesmo resultado no browser e no pedido`, async () => {
        const beneficio = tipo ? { tipo_desconto: tipo, valor_desconto: valor } : null;
        assert.equal(Precos.calcularCentavos(preco, beneficio), esperado);
        assert.equal(browser.window.Precos.calcularCentavos(preco, beneficio), esperado);
        assert.ok(esperado <= Precos.paraCentavos(preco));
        const client = { async query(sql) {
            if (sql.includes('FROM usuarios')) return { rows: [{ id: 7, is_vip: !!beneficio, vip_tipo: 'personalizado' }] };
            if (sql.includes('FROM vinhos')) return { rows: [{ id: 1, nome: 'Teste', tipo: 'tinto', preco, ativo: true }] };
            return { rows: beneficio ? [beneficio] : [] };
        } };
        const pedido = await calcularPedido(client, 7, [{ id: 1, quantidade: 3 }]);
        assert.equal(pedido.itens[0].preco, esperado / 100);
        assert.equal(pedido.total, esperado * 3 / 100);
    });
}

for (const value of [null, undefined, '', true, false, '-1.00', '1.001', 'NaN', Infinity, '100000000.00']) {
    test(`valor monetário inválido é recusado: ${String(value)}`, () => {
        assert.throws(() => Precos.paraCentavos(value), { code: 'PRECO_INVALIDO' });
    });
}

for (const beneficio of [
    { tipo_desconto: 'percentual', valor_desconto: '100.01' },
    { tipo_desconto: 'percentual', valor_desconto: '-1' },
    { tipo_desconto: 'valor_fixo', valor_desconto: null },
    { tipo_desconto: 'valor_fixo', valor_desconto: '0.001' },
    { tipo_desconto: 'outro', valor_desconto: '1.00' }
]) {
    test(`benefício inválido é recusado: ${JSON.stringify(beneficio)}`, () => {
        assert.throws(() => Precos.calcularCentavos('100.00', beneficio), { code: 'BENEFICIO_INVALIDO' });
    });
}

function pagina() {
    const elements = new Map();
    const element = () => ({ innerHTML: '', style: {}, dataset: {}, addEventListener() {},
        querySelectorAll: () => [], querySelector: () => element() });
    const prices = ['card', 'destaque', 'modal'].map(() => ({ innerHTML: '', dataset: { precoVinho: '1' } }));
    const context = {
        URL, console: { log() {}, error() {}, warn() {}, debug() {} }, setInterval() {}, setTimeout() {},
        fetch: async () => ({ ok: false }), localStorage: { getItem: () => null },
        document: { readyState: 'loading', addEventListener() {},
            querySelectorAll: selector => selector === '[data-preco-vinho]' ? prices : [],
            getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); } },
        window: { location: { origin: 'https://catalogo.example.com', hostname: 'catalogo.example.com' },
            Precos, RenderSeguro: require('../js/render-seguro'),
            authManager: { usuarioLogado: { is_vip: true, vip_tipo: 'personalizado' }, atualizarInterface() {} } }
    };
    vm.createContext(context);
    for (const file of ['js/api.js', 'js/vip-manager.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    const cartSource = fs.readFileSync(path.join(root, 'js/carrinho.js'), 'utf8').split('// Instância global')[0];
    vm.runInContext(cartSource + '\nthis.ClasseCarrinho = CarrinhoManager;', context);
    context.produtos = [{ id: 1, nome: 'Moscatel', tipo: 'espumante', uva: 'Moscato', ano: 2024, preco: '119.00', ativo: true }];
    vm.runInContext(`vinhoManager.vinhos = produtos;
        vinhoManager.carregarVinhos = async () => produtos;
        vinhoManager.carregarConfiguracoes = async () => ({});`, context);
    context.window.vipManager.beneficios = [{ slug: 'personalizado', nome: 'VIP', cor: '#123456', tipo_desconto: 'percentual', valor_desconto: '7.00' }];
    context.window.atualizarPrecosExibidos = context.atualizarPrecosExibidos;
    const carrinho = Object.create(context.ClasseCarrinho.prototype);
    carrinho.itens = [{ ...context.produtos[0], quantidade: 3 }];
    context.window.carrinhoManager = carrinho;
    return { context, elements, carrinho, prices };
}

test('card, destaque, modal e carrinho exibem o mesmo preço VIP e total em centavos', async () => {
    const { context, elements, carrinho } = pagina();
    await context.renderizarVinhos();
    await context.renderizarDestaqueSemana();
    context.abrirModal(1);
    carrinho.atualizarInterface();
    for (const id of ['vinhos-container', 'destaque-semana', 'modal-body', 'carrinho-body']) {
        assert.match(elements.get(id).innerHTML, /110,67/, id);
        assert.match(elements.get(id).innerHTML, /119,00/, id);
    }
    assert.equal(carrinho.getTotal(), 332.01);
});

test('falha da API VIP remove descontos antigos em todas as superfícies e permite tentar novamente', async () => {
    const { context, prices, carrinho } = pagina();
    await context.window.vipManager._carregarDaApi();
    assert.equal(context.window.vipManager.beneficios.length, 0);
    assert.equal(context.window.vipManager.carregado, false);
    assert.equal(carrinho.getDescontoVip('119.00'), 119);
    for (const price of prices) {
        assert.match(price.innerHTML, /119,00/);
        assert.doesNotMatch(price.innerHTML, /preco-original|badge-vip/);
    }
    context.fetch = async () => ({ ok: true, json: async () => [{ slug: 'personalizado', nome: 'VIP', tipo_desconto: 'valor_fixo', valor_desconto: '12.35' }] });
    await context.window.vipManager.carregar();
    assert.equal(context.window.vipManager.carregado, true);
    assert.equal(carrinho.getDescontoVip('119.00'), 106.65);
    assert.match(prices[0].innerHTML, /106,65/);
});

test('logout e benefício desativado restauram preços sem descontos fixos inventados', () => {
    const { context, prices, carrinho } = pagina();
    context.window.authManager.usuarioLogado = null;
    context.atualizarPrecosExibidos();
    assert.equal(carrinho.getTotal(), 357);
    assert.match(prices[0].innerHTML, /119,00/);
    context.window.authManager.usuarioLogado = { is_vip: true, vip_tipo: 'personalizado' };
    context.window.vipManager.beneficios[0].ativo = false;
    assert.equal(carrinho.getDescontoVip(119), 119);
});

test('carrinho atualiza preço base sem aplicar desconto duas vezes e identifica produto oculto', () => {
    const { context, carrinho } = pagina();
    carrinho.salvarCarrinho = () => {};
    carrinho.itens.push({ id: 99, nome: 'Oculto', preco: 10, quantidade: 1 });
    carrinho.atualizarProdutos([{ ...context.produtos[0], preco: '100.00' }]);
    assert.equal(carrinho.itens[0].preco, 100);
    assert.equal(carrinho.getDescontoVip(carrinho.itens[0].preco), 93);
    assert.equal(carrinho.itens[1].indisponivel, true);
});

test('requisição administrativa do frontend envia token e mantém a flag explícita', async () => {
    const { context } = pagina();
    context.window.authManager.obterToken = () => 'token-admin';
    const requests = [];
    context.fetch = async (url, options) => { requests.push({ url: String(url), options }); return { ok: true, json: async () => ({ data: [], pagination: { totalPages: 1 } }) }; };
    // Usar o carregador real, sem a substituição de renderização do fixture.
    await vm.runInContext('VinhoManager.prototype.carregarVinhos.call(vinhoManager, true)', context);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer token-admin');
    assert.match(requests[0].url, /admin=true/);
});

test('recompra ignora produto oculto e usa somente o preço atual retornado pela API', async () => {
    const { context, carrinho } = pagina();
    vm.runInContext(fs.readFileSync(path.join(root, 'js/perfil.js'), 'utf8') + '\nthis.ClassePerfil = PerfilManager;', context);
    const perfil = Object.create(context.ClassePerfil.prototype);
    const messages = [];
    perfil.mostrarMensagem = message => messages.push(message);
    carrinho.salvarCarrinho = () => {};
    carrinho.abrirCarrinho = () => {};
    context.fetch = async url => String(url).endsWith('/99')
        ? { ok: false, status: 404 }
        : { ok: true, json: async () => ({ ...context.produtos[0], preco: '100.00' }) };
    await perfil.refazerPedido({ itens: [ { vinho_id: 1, preco_unitario: '0.01', quantidade: 2 }, { vinho_id: 99, quantidade: 1 } ] });
    assert.equal(carrinho.itens.length, 1);
    assert.equal(carrinho.itens[0].preco, 100);
    assert.equal(carrinho.getTotal(), 186);
    assert.match(messages[0], /Alguns itens/);
    const before = JSON.stringify(carrinho.itens);
    await perfil.refazerPedido({ itens: [{ vinho_id: 99, quantidade: 1 }] });
    assert.equal(JSON.stringify(carrinho.itens), before);
    assert.match(messages.at(-1), /não estão mais disponíveis/);
});
