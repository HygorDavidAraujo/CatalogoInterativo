const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const base = 'https://res.cloudinary.com/demo/image/upload/';
const arquivo = 'v123/catalogo/vinho.png';
function carregarConfig() {
    const window = { location: { hostname: 'catalogo.example.com', origin: 'https://catalogo.example.com' } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), { window, URL, console: { log() {} } });
    return window;
}

test('otimização repetida do card mantém uma única transformação de imagem', () => {
    const config = carregarConfig();
    let url = base + arquivo;
    for (let i = 0; i < 10; i++) url = config.optimizeCloudinaryUrl(url, 'card');
    assert.equal(url, `${base}c_fit,w_400,h_400,q_auto,f_auto/${arquivo}`);
});

test('ficha substitui tamanho de card por 800px em vez de encadear reduções', () => {
    const config = carregarConfig();
    const card = config.optimizeCloudinaryUrl(base + arquivo, 'card');
    const detail = config.optimizeCloudinaryUrl(card, 'detail');
    assert.equal(detail, `${base}c_fit,w_800,h_800,q_auto,f_auto/${arquivo}`);
    assert.equal(config.getOriginalCloudinaryUrl(detail), base + arquivo);
});

test('URLs antigas com tamanhos acumulados são corrigidas sem alterar o registro no banco', () => {
    const config = carregarConfig();
    const antiga = `${base}${'c_fit,w_400,h_400,q_auto,f_auto/'.repeat(3)}${arquivo}`;
    assert.equal(config.getOriginalCloudinaryUrl(antiga), base + arquivo);
    assert.equal(config.optimizeCloudinaryUrl(antiga, 'detail'), `${base}c_fit,w_800,h_800,q_auto,f_auto/${arquivo}`);
});

test('transformações personalizadas, versão, pastas, query e fragmento são preservados', () => {
    const config = carregarConfig();
    const original = `${base}c_crop,g_center,w_900,h_900/e_sepia/${arquivo}?download=1#foto`;
    const card = config.optimizeCloudinaryUrl(original, 'card');
    assert.equal(card, `${base}c_fit,w_400,h_400,q_auto,f_auto/c_crop,g_center,w_900,h_900/e_sepia/${arquivo}?download=1#foto`);
    assert.equal(config.getOriginalCloudinaryUrl(card), original);
});

test('assinaturas e URLs de outros serviços permanecem intactas', () => {
    const config = carregarConfig();
    for (const value of [null, undefined, '', '/images/vinho.png', 'https://example.com/upload/vinho.png',
        'https://res.cloudinary.com.example.com/image/upload/vinho.png', `${base}s--assinatura--/${arquivo}`,
        'https://res.cloudinary.com/demo/video/upload/v123/video.mp4']) {
        assert.equal(config.optimizeCloudinaryUrl(value), value);
        assert.equal(config.getOriginalCloudinaryUrl(value), value);
    }
});

test('edição usa a URL original no formulário e preserva alterações personalizadas', async () => {
    const config = carregarConfig();
    const fields = new Map();
    const original = `${base}c_crop,g_center,w_900,h_900/${arquivo}`;
    const legado = config.optimizeCloudinaryUrl(original, 'card');
    const vinho = { id: 1, nome: 'Merlot', tipo: 'tinto', uva: 'Merlot', ano: 2024, preco: 100,
        imagem: config.optimizeCloudinaryUrl(legado, 'card'), imagemOriginal: legado, ficha_tecnica: {} };
    const context = { window: { ...config, FichaVinho: require('../js/ficha-vinho'), resolverUrlImagem: value => value },
        document: { addEventListener() {}, querySelector: () => null, getElementById(id) {
            if (!fields.has(id)) fields.set(id, { value: '', style: {}, scrollIntoView() {} });
            return fields.get(id);
        } }, console: { log() {} }, vinhoManager: { getVinhoPorId: () => vinho } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'js/api-admin.js'), 'utf8'), context);
    await context.editarVinho(1);
    assert.equal(fields.get('imagem-url').value, original);
});
