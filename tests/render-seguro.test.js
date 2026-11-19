const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const seguro = require('../js/render-seguro');

const root = path.join(__dirname, '..');
const ataque = `"'><img data-invasor src=x onerror="globalThis.invadido=true"><script>globalThis.invadido=true</script>&`;
const vinho = {
    id: 1, nome: ataque, uva: ataque, tipo: 'espumante', preco: '119.00', ano: 2024,
    pais_origem: ataque, pais_codigo: 'BR', ativo: true, descricao: ataque,
    harmonizacao: ataque, guarda: ataque, imagem: 'javascript:alert(1)', bandeira_url: 'data:text/html,ataque'
};

function elemento() {
    const children = new Map();
    return {
        innerHTML: '', textContent: '', style: {}, dataset: {},
        addEventListener() {}, querySelectorAll: () => [],
        querySelector(selector) {
            if (!children.has(selector)) children.set(selector, elemento());
            return children.get(selector);
        }
    };
}

function pagina(files) {
    const elements = new Map();
    const context = {
        URL, console: { log() {}, error() {}, warn() {}, debug() {} },
        setInterval() {}, setTimeout() {}, API_URL: '/api',
        localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null },
        fetch: async () => ({ ok: false }),
        window: { Precos: require('../js/precos'), RenderSeguro: seguro, location: { origin: 'https://catalogo.example.com', hostname: 'catalogo.example.com' } },
        document: {
            readyState: 'loading', addEventListener() {}, querySelectorAll: () => [],
            createElement: elemento, body: { appendChild() {} },
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, elemento());
                return elements.get(id);
            }
        }
    };
    vm.createContext(context);
    for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    return { context, elements };
}

function semInjecao(html) {
    assert.ok(html.includes(seguro.texto(ataque)), 'o conteúdo deve aparecer como texto escapado');
    assert.doesNotMatch(html, /<img data-invasor|<script>|\son(?:error|click|change)\s*=\s*["']/i);
    assert.doesNotMatch(html, /(?:src|href)="(?:javascript:|data:text\/html)/i);
}

test('escape preserva caracteres de texto sem permitir tags ou quebra de atributos', () => {
    assert.equal(seguro.texto(`<a title="d'água">A&B</a>`), '&lt;a title=&quot;d&#39;água&quot;&gt;A&amp;B&lt;/a&gt;');
    assert.equal(seguro.texto(null), '');
    const copy = seguro.dados(vinho);
    assert.equal(copy.nome, seguro.texto(ataque));
    assert.equal(copy.imagem, '');
    assert.equal(vinho.nome, ataque, 'a apresentação não pode modificar os dados de negócio');
});

test('URLs recusam protocolos executáveis, credenciais e cores recusam CSS arbitrário', () => {
    for (const value of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>', 'vbscript:msgbox(1)', 'https://user:pass@example.com/a']) {
        assert.equal(seguro.url(value, '/fallback.svg'), '/fallback.svg');
    }
    assert.equal(seguro.url('https://res.cloudinary.com/demo/image/upload/a.png'), 'https://res.cloudinary.com/demo/image/upload/a.png');
    assert.equal(seguro.cor('#C19A6B'), '#C19A6B');
    assert.equal(seguro.cor('red;background-image:url(https://example.com)'), '#6B1C40');
    assert.equal(seguro.id('1;alert(1)'), null);
    assert.equal(seguro.id('7'), 7);
});

test('catálogo, destaque e ficha exibem dados hostis sem criar HTML executável', async () => {
    const { context, elements } = pagina(['js/api.js']);
    context.fixture = vinho;
    vm.runInContext(`vinhoManager.vinhos = [fixture];
        vinhoManager.carregarVinhos = async () => vinhoManager.vinhos;
        vinhoManager.carregarConfiguracoes = async () => ({});`, context);
    await context.renderizarVinhos();
    semInjecao(elements.get('vinhos-container').innerHTML);
    await context.renderizarDestaqueSemana();
    semInjecao(elements.get('destaque-semana').innerHTML);
    context.abrirModal(1);
    semInjecao(elements.get('modal-body').innerHTML);
});

test('carrinho protege nomes e imagens persistidos no navegador', () => {
    const { context, elements } = pagina([]);
    const source = fs.readFileSync(path.join(root, 'js/carrinho.js'), 'utf8').split('// Instância global')[0];
    vm.runInContext(source + '\nthis.ClasseCarrinho = CarrinhoManager;', context);
    const carrinho = Object.create(context.ClasseCarrinho.prototype);
    carrinho.itens = [{ ...vinho, quantidade: 1 }];
    carrinho.getDescontoVip = preco => preco;
    carrinho.atualizarInterface();
    semInjecao(elements.get('carrinho-body').innerHTML);
});

test('administração protege opções, lista de vinhos e benefícios VIP', async () => {
    const { context, elements } = pagina(['js/api-admin.js']);
    context.vinhoManager = { vinhos: [vinho], async carregarVinhos() {} };
    context.window.resolverUrlImagem = seguro.url;
    await context.preencherDestaqueSemana({});
    semInjecao(elements.get('config-destaque-vinho').innerHTML);
    await context.renderizarListaAdmin();
    semInjecao(elements.get('lista-vinhos-admin').innerHTML);
    context.fixture = { id: 1, nome: ataque, slug: ataque, tipo_desconto: 'percentual', valor_desconto: 3, cor: 'red;background:url(x)', ordem: 1 };
    vm.runInContext('beneficiosVip = [fixture];', context);
    context.renderizarBeneficios();
    semInjecao(elements.get('lista-beneficios').innerHTML);
    assert.doesNotMatch(elements.get('lista-beneficios').innerHTML, /background:url/);
});

test('clientes e históricos protegem dados pessoais, observações e nomes dos itens', async () => {
    const { context, elements } = pagina(['js/pedido-status.js', 'js/clientes.js', 'js/perfil.js']);
    const cliente = { id: 7, nome_completo: ataque, email: ataque, telefone: ataque, created_at: '2026-01-01' };
    context.renderizarClientes([cliente]);
    semInjecao(elements.get('lista-clientes').innerHTML);
    const pedido = { id: 42, created_at: '2026-01-01', status: 'pendente', total: 119, observacoes: ataque,
        itens: [{ vinho_nome: ataque, quantidade: 1, preco_unitario: 119, subtotal: 119 }] };
    semInjecao(context.renderizarPedido(pedido));
    context.fixture = cliente;
    vm.runInContext('todosClientes = [fixture]; this.ClassePerfil = PerfilManager;', context);
    context.document.querySelector = () => ({ setAttribute() {} });
    context.fetch = async () => ({ ok: true, json: async () => [pedido] });
    await context.abrirModalCliente(7);
    semInjecao(elements.get('modal-cliente-body').innerHTML);
    const perfil = Object.create(context.ClassePerfil.prototype);
    semInjecao(perfil.renderizarPedido(pedido));
});

test('badge VIP limita cores e exibe nome/slug hostis como texto', () => {
    const { context } = pagina(['js/vip-manager.js']);
    context.window.vipManager.beneficios = [{ slug: ataque, nome: ataque, cor: 'red;background:url(x)' }];
    const html = context.window.vipManager.getBadgeHtml(ataque);
    semInjecao(html);
    assert.doesNotMatch(html, /background:url/);
});

test('páginas usam scripts externos e Vercel bloqueia scripts inline e eval em arquivos estáticos', () => {
    for (const file of ['index.html', 'admin.html', 'clientes.html', 'meu-perfil.html', 'reset-senha.html']) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, file);
        assert.doesNotMatch(html, /\son[a-z]+\s*=/i, file);
        for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, src)), src);
        if (file !== 'reset-senha.html') assert.ok(html.indexOf('js/render-seguro.js') < html.indexOf('js/auth.js'), file);
    }
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const headers = config.headers.find(rule => rule.source === '/(.*)').headers;
    const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
    assert.match(csp, /(?:^|; )script-src 'self';/);
    assert.match(csp, /script-src-attr 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    for (const file of fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js'))) {
        const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
        assert.doesNotMatch(source, /\son(?:click|change|error)="/i, file);
    }
});
