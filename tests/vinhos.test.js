const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Readable, Writable } = require('node:stream');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');

const root = path.join(__dirname, '..');
const secret = 'chave-exclusiva-dos-testes-de-vinhos';
const quietConsole = { log() {}, error() {}, warn() {}, debug() {} };
const dadosProduto = {
    ano: '2024', bandeira_url: 'https://flagcdn.com/w80/br.png',
    descricao: 'O Espumante Moscatel Branco Jolimont é produzido pela tradicional Vitivinícola Jolimont em Canela, na Serra Gaúcha, utilizando uvas 100% Moscato. Com um teor alcoólico leve de 7,5% vol e potencial de guarda de até dois anos, este rótulo doce é amplamente reconhecido internacionalmente, somando mais de trinta premiações como a Medalha de Ouro no prestigiado Vinalies Internationales em Paris. Visualmente, ele se apresenta como uma bebida brilhante de coloração amarelo-claro com reflexos esverdeados, caracterizada por borbulhas finas, intensas e persistentes. No olfato, revela um aroma delicado e marcante, onde sobressaem notas florais como jasmim, integradas a nuances de frutas brancas e cítricas como pêssego, pera, maçã verde e abacaxi. Em boca, destaca-se por ser muito refrescante e leve, trazendo uma textura cremosa e um equilíbrio perfeito entre sua acidez viva e a doçura natural da uva, deixando um final suave e muito aromático quando servido na temperatura ideal de 6°C a 8°C.',
    guarda: '2 a 3 anos',
    harmonizacao: 'Par perfeito para sobremesas como cheesecakes, tortas de frutas e fondue de chocolate. Ele também acompanha muito bem frutas frescas, queijos suaves como brie e camembert, além de sushis ou pratos asiáticos agridoces.',
    nome: 'Espumante Moscatel Branco Jolimont 750ml', pais_codigo: 'BR',
    pais_origem: 'Brasil', preco: '119.00', tipo: 'espumante', uva: 'Moscatel', ativo: 'true'
};

function carregarModulo(relativePath, overrides = {}, globals = {}) {
    const filename = path.join(root, relativePath);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, console: quietConsole, __dirname: path.dirname(filename),
        require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name),
        ...globals
    }, { filename });
    return module.exports;
}

function multipart(fields, file) {
    const boundary = 'vinhos-boundary-unit-test';
    const chunks = [];
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }
    if (file) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="imagem"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
        chunks.push(file.buffer, Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return { buffer: Buffer.concat(chunks), boundary };
}

function criarApi(options = {}) {
    const env = { NODE_ENV: 'production', VERCEL: '1', JWT_SECRET: secret };
    if (options.configurado) Object.assign(env, {
        CLOUDINARY_CLOUD_NAME: 'unit-test', CLOUDINARY_API_KEY: 'unit-key', CLOUDINARY_API_SECRET: 'unit-private-secret'
    });
    if (options.env) Object.assign(env, options.env);
    const logs = [];
    const logger = Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level,
        (message, metadata) => logs.push({ level, message, metadata })]));
    const errors = carregarModulo('middleware/errorHandler.js', { '../config/logger': logger }, { process: { env } });
    const uploads = [];
    const cloudinary = {
        config() {},
        uploader: {
            upload_stream(params, callback) {
                uploads.push(params);
                let bytes = 0;
                return new Writable({
                    write(chunk, encoding, next) { bytes += chunk.length; next(); },
                    final(next) {
                        callback(options.erroUpload || null, {
                            secure_url: 'https://res.cloudinary.com/unit-test/image/upload/vinhos/test.png',
                            bytes, public_id: 'vinhos/test'
                        });
                        next();
                    }
                });
            },
            destroy(id, opts, callback) {
                if (typeof opts === 'function') callback = opts;
                if (callback) callback(null, { result: 'ok' });
                return Promise.resolve({ result: 'ok' });
            }
        }
    };
    const configUpload = carregarModulo('config/cloudinary.js', {
        cloudinary: { v2: cloudinary }, '../middleware/errorHandler': errors
    }, { process: { env } });
    const colunas = ['nome', 'tipo', 'uva', 'pais_origem', 'pais_codigo', 'bandeira_url', 'ano', 'guarda', 'harmonizacao', 'descricao', 'preco', 'imagem', 'ativo'];
    let registro = options.vinhoInicial ? { ...options.vinhoInicial } : null;
    const writes = [];
    const pool = { async query(sql, params) {
        if (sql.includes('FROM sessoes_usuario s')) {
            return { rows: [{ id: 7, email: 'admin@example.com', is_admin: options.admin !== false }] };
        }
        if (sql.startsWith('INSERT INTO vinhos') || sql.startsWith('UPDATE vinhos SET')) {
            if (options.erroBanco) throw options.erroBanco;
            writes.push({ sql, params: Array.from(params) });
            registro = { id: 101, ...Object.fromEntries(colunas.map((coluna, index) => [coluna, params[index]])) };
            return { rows: [{ id: 101 }], rowCount: 1 };
        }
        if (sql.startsWith('SELECT * FROM vinhos WHERE id')) {
            return { rows: registro && Number(params[0]) === registro.id ? [{ ...registro }] : [] };
        }
        throw new Error(`Consulta inesperada no teste: ${sql}`);
    } };
    const auth = carregarModulo('middleware/auth.js', { '../config/database': { pool } }, { process: { env } });
    const passthrough = (req, res, next) => next();
    const router = carregarModulo('routes/vinhos.js', {
        '../config/database': { pool }, '../config/cloudinary': configUpload,
        '../middleware/auth': auth, '../middleware/rateLimiter': { uploadLimiter: passthrough },
        '../middleware/errorHandler': errors, '../config/logger': logger,
        '../services/cacheService': { cacheMiddleware: () => passthrough, async invalidateVinhosCache() {} }
    });
    const token = jwt.sign({ id: 7, isAdmin: true }, secret, {
        expiresIn: '7d', jwtid: '11111111-1111-4111-8111-111111111111'
    });

    async function request(method, url, fields = dadosProduto, file = null, requestToken = token) {
        const body = multipart(fields, file);
        const req = Readable.from([body.buffer]);
        Object.assign(req, {
            method, url, originalUrl: `/api/vinhos${url}`, params: {}, query: {},
            headers: {
                'content-type': `multipart/form-data; boundary=${body.boundary}`,
                'content-length': String(body.buffer.length),
                ...(requestToken ? { authorization: `Bearer ${requestToken}` } : {})
            }
        });
        return new Promise((resolve, reject) => {
            const res = {
                statusCode: 200,
                status(code) { this.statusCode = code; return this; },
                json(data) { resolve(JSON.parse(JSON.stringify({ status: this.statusCode, body: data }))); }
            };
            router.handle(req, res, error => {
                if (!error) return reject(new Error('Rota não encontrada'));
                errors.transformKnownErrors(error, req, res, normalized => errors.errorHandler(normalized, req, res, reject));
            });
        });
    }
    return { request, uploads, writes, logs, token, errors, env, getRegistro: () => registro };
}

const imagemPequena = () => ({
    name: 'Espumante moscatel Branco.png', type: 'image/png', buffer: Buffer.alloc(Math.round(1.13 * 1024 * 1024))
});

test('imagem de 1,13 MB sem Cloudinary configurado retorna diagnóstico e não grava produto', async () => {
    const api = criarApi();
    const result = await api.request('POST', '/', dadosProduto, imagemPequena());
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'UPLOAD_NOT_CONFIGURED');
    assert.match(result.body.message, /não está configurado/);
    assert.equal(api.uploads.length, 0);
    assert.equal(api.writes.length, 0);
    assert.equal(api.logs.at(-1).metadata.etapa, 'upload-imagem');
    assert.deepEqual(Array.from(api.logs.at(-1).metadata.missingVariables), ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);
});

test('dados do produto informado e imagem de 1,13 MB passam por multipart, validação e gravação', async () => {
    const api = criarApi({ configurado: true });
    const result = await api.request('POST', '/', dadosProduto, imagemPequena());
    assert.equal(result.status, 201);
    assert.equal(result.body.nome, dadosProduto.nome);
    assert.equal(result.body.ano, 2024);
    assert.equal(result.body.preco, 119);
    assert.equal(result.body.pais_codigo, 'BR');
    assert.equal(result.body.bandeira_url, dadosProduto.bandeira_url);
    assert.equal(result.body.descricao, dadosProduto.descricao);
    assert.equal(result.body.ativo, true);
    assert.match(result.body.imagem, /^https:\/\/res.cloudinary.com\//);
    assert.equal(api.writes.length, 1);
    assert.equal(api.uploads.length, 1);
});

test('cadastro sem foto não exige credenciais de upload', async () => {
    const api = criarApi();
    const result = await api.request('POST', '/');
    assert.equal(result.status, 201);
    assert.equal(api.uploads.length, 0);
    assert.equal(result.body.imagem, '');
});

test('imagem por URL é preservada e não exige Cloudinary configurado', async () => {
    const api = criarApi();
    const imagemUrl = 'https://example.com/foto.png';
    const result = await api.request('POST', '/', { ...dadosProduto, imagemUrl });
    assert.equal(result.status, 201);
    assert.equal(result.body.imagem, imagemUrl);
    assert.equal(result.body.pais_codigo, 'BR');
    assert.equal(api.uploads.length, 0);
});

test('edição por URL mantém os campos novos e o restante do cadastro', async () => {
    const api = criarApi({ vinhoInicial: { id: 101, ...dadosProduto, ano: 2024, preco: 119, ativo: false, imagem: 'https://example.com/antiga.png' } });
    const result = await api.request('PUT', '/101', { imagemUrl: 'https://example.com/nova.png', pais_codigo: 'br', bandeira_url: dadosProduto.bandeira_url });
    assert.equal(result.status, 200);
    assert.equal(result.body.imagem, 'https://example.com/nova.png');
    assert.equal(result.body.pais_codigo, 'BR');
    assert.equal(result.body.nome, dadosProduto.nome);
    assert.equal(result.body.ativo, false);
    assert.equal(api.uploads.length, 0);
});

test('URL inválida ou com javascript é recusada antes da gravação', async () => {
    for (const imagemUrl of ['javascript:alert(1)', 'url-invalida']) {
        const api = criarApi();
        const result = await api.request('POST', '/', { ...dadosProduto, imagemUrl });
        assert.equal(result.status, 400);
        assert.equal(api.writes.length, 0);
    }
});

test('falha de autenticação do provedor é tratada e segredos não aparecem em logs ou resposta', async () => {
    const api = criarApi({ configurado: true, erroUpload: { http_code: 401, message: 'Invalid credential unit-private-secret' } });
    const result = await api.request('POST', '/', dadosProduto, imagemPequena());
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'UPLOAD_AUTH_FAILED');
    assert.equal(api.writes.length, 0);
    assert.equal(JSON.stringify(result).includes('unit-private-secret'), false);
    assert.equal(JSON.stringify(api.logs).includes('unit-private-secret'), false);
    assert.match(api.logs.at(-1).metadata.causeMessage, /REDACTED/);
});

test('falha do serviço de imagens não grava dados nem vira erro desconhecido', async () => {
    const api = criarApi({ configurado: true, erroUpload: { http_code: 500, message: 'Provider unavailable' } });
    const result = await api.request('POST', '/', dadosProduto, imagemPequena());
    assert.equal(result.status, 502);
    assert.equal(result.body.code, 'UPLOAD_FAILED');
    assert.equal(api.writes.length, 0);
    assert.equal(api.logs.at(-1).metadata.providerStatus, 500);
});

test('formato de arquivo não suportado retorna erro 400 sem chamar provedor', async () => {
    const api = criarApi({ configurado: true });
    const result = await api.request('POST', '/', dadosProduto, { name: 'foto.svg', type: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /JPG, PNG ou WebP/);
    assert.equal(api.uploads.length, 0);
});

test('limite de tamanho do Multer retorna 413 e não grava produto', async () => {
    const api = criarApi({ configurado: true });
    const result = await api.request('POST', '/', dadosProduto, { ...imagemPequena(), buffer: Buffer.alloc(6 * 1024 * 1024) });
    assert.equal(result.status, 413);
    assert.equal(result.body.code, 'LIMIT_FILE_SIZE');
    assert.equal(api.writes.length, 0);
});

test('falha no banco identifica a etapa no log sem expor detalhes ao navegador', async () => {
    const api = criarApi({ erroBanco: new Error('database internal detail') });
    const result = await api.request('POST', '/');
    assert.equal(result.status, 500);
    assert.equal(result.body.message.includes('database internal detail'), false);
    assert.equal(api.logs.at(-1).metadata.etapa, 'cadastrar-vinho');
    assert.equal(api.logs.at(-1).metadata.errorMessage, 'database internal detail');
});

test('cadastro e upload continuam restritos a administradores autenticados', async () => {
    const api = criarApi({ configurado: true, admin: false });
    assert.equal((await api.request('POST', '/', dadosProduto, imagemPequena())).status, 403);
    assert.equal((await api.request('POST', '/', dadosProduto, imagemPequena(), null)).status, 401);
    assert.equal(api.writes.length, 0);
    assert.equal(api.uploads.length, 0);
});

function criarFormulario(fetchImpl, options = {}) {
    const fields = {};
    for (const [key, value] of Object.entries(dadosProduto)) {
        const id = ({ pais_origem: 'pais-origem', pais_codigo: 'pais-codigo', bandeira_url: 'bandeira-url' })[key] || key;
        fields[id] = { value, checked: key === 'ativo', disabled: false };
    }
    fields['imagem-url'] = { value: '', disabled: false };
    fields['btn-cancelar'] = { disabled: false, addEventListener() {} };
    const button = { disabled: false, innerHTML: 'Salvar Vinho' };
    const handlers = [];
    const form = {
        dataset: {}, addEventListener(event, handler) { if (event === 'submit') handlers.push(handler); },
        querySelector: () => button,
        querySelectorAll: () => [...Object.values(fields), button]
    };
    fields['form-vinho'] = form;
    const mensagens = [];
    let limpezas = 0;
    let atualizacoes = 0;
    const context = {
        document: { addEventListener() {}, getElementById: id => fields[id] || null },
        window: { authManager: { obterToken: () => options.token || 'token-simulado' } },
        localStorage: { getItem: () => null }, API_URL: '/api', FormData,
        console: quietConsole, fetch: fetchImpl
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'js/api-admin.js'), 'utf8'), context);
    context.mostrarMensagem = (texto, tipo) => mensagens.push({ texto, tipo });
    context.limparFormulario = () => { limpezas++; };
    context.renderizarListaAdmin = async () => {
        atualizacoes++;
        if (options.falharLista) throw new Error('Falha ao carregar lista');
    };
    context.configurarFormulario();
    return { context, fields, form, button, handlers, mensagens,
        getLimpezas: () => limpezas, getAtualizacoes: () => atualizacoes,
        submit: () => handlers[0]({ preventDefault() {} }) };
}

test('formulário recebe diagnóstico de upload ausente e preserva os dados para nova tentativa', async () => {
    const api = criarApi();
    const pagina = criarFormulario(async (url, options) => {
        const fields = {};
        let foto;
        for (const [key, value] of options.body.entries()) {
            if (typeof value.arrayBuffer === 'function') {
                foto = { name: value.name, type: value.type, buffer: Buffer.from(await value.arrayBuffer()) };
            } else fields[key] = value;
        }
        const result = await api.request(options.method, '/', fields, foto);
        return { ok: result.status < 400, status: result.status, json: async () => result.body };
    }, { token: api.token });
    const foto = imagemPequena();
    pagina.context.fileFixture = new File([foto.buffer], foto.name, { type: foto.type });
    vm.runInContext('imagemUpload = fileFixture;', pagina.context);
    await pagina.submit();
    assert.equal(pagina.getLimpezas(), 0);
    assert.equal(pagina.getAtualizacoes(), 0);
    assert.equal(pagina.fields.nome.value, dadosProduto.nome);
    assert.equal(pagina.fields.descricao.value, dadosProduto.descricao);
    assert.equal(pagina.button.disabled, false);
    assert.match(pagina.mensagens[0].texto, /não está configurado/);
    assert.deepEqual(pagina.mensagens.map(mensagem => mensagem.tipo), ['erro']);
});

test('envios repetidos e configuração repetida não duplicam requisições nem mostram sucesso antecipado', async () => {
    let concluir;
    let chamadas = 0;
    const pagina = criarFormulario(() => {
        chamadas++;
        return new Promise(resolve => { concluir = resolve; });
    });
    pagina.context.configurarFormulario();
    assert.equal(pagina.handlers.length, 1);
    const primeira = pagina.submit();
    await pagina.submit();
    assert.equal(chamadas, 1);
    assert.equal(pagina.button.disabled, true);
    assert.equal(pagina.mensagens.length, 0);
    concluir({ ok: true, status: 201 });
    await primeira;
    assert.deepEqual(pagina.mensagens.map(mensagem => mensagem.tipo), ['sucesso']);
    assert.equal(pagina.getLimpezas(), 1);
    assert.equal(pagina.getAtualizacoes(), 1);
    assert.equal(pagina.button.disabled, false);
    assert.equal(pagina.fields['btn-cancelar'].disabled, false);
});

test('formulário mostra mensagem e campos inválidos recebidos da API em vez de erro genérico', async () => {
    const pagina = criarFormulario(async () => ({
        ok: false, status: 400, json: async () => ({ message: 'Dados inválidos', errors: [{ field: 'preco', message: 'Preço inválido' }] })
    }));
    await pagina.submit();
    assert.equal(pagina.mensagens[0].texto, 'Preço inválido');
    assert.equal(pagina.getLimpezas(), 0);
    assert.equal(pagina.button.disabled, false);
});

test('413 sem JSON devolve orientação de tamanho sem apagar formulário', async () => {
    const pagina = criarFormulario(async () => ({ ok: false, status: 413, json: async () => { throw new Error('Resposta não JSON'); } }));
    await pagina.submit();
    assert.match(pagina.mensagens[0].texto, /Reduza o arquivo/);
    assert.equal(pagina.getLimpezas(), 0);
});

test('falha ao atualizar lista após salvar não informa que o cadastro falhou', async () => {
    const pagina = criarFormulario(async () => ({ ok: true, status: 201 }), { falharLista: true });
    await pagina.submit();
    assert.equal(pagina.getLimpezas(), 1);
    assert.match(pagina.mensagens.at(-1).texto, /produto foi salvo/);
    assert.equal(pagina.button.disabled, false);
});

test('logger de produção preserva mensagem e metadados em JSON sem códigos de cor', async () => {
    const winston = require('winston');
    const Transport = require('winston-transport');
    const linhas = [];
    class ConsoleTeste extends Transport {
        log(info, callback) { linhas.push(info[Symbol.for('message')]); callback(); }
    }
    const logger = carregarModulo('config/logger.js', {
        winston: { ...winston, transports: { ...winston.transports, Console: ConsoleTeste } }
    }, { process: { env: { NODE_ENV: 'production', VERCEL: '1' } } });
    logger.error('Erro no servidor', { errorMessage: 'Detalhe do upload', code: 'UPLOAD_FAILED', etapa: 'upload-imagem' });
    const terminou = once(logger, 'finish');
    logger.end();
    await terminou;
    const registro = JSON.parse(linhas[0]);
    assert.equal(registro.level, 'error');
    assert.equal(registro.message, 'Erro no servidor');
    assert.equal(registro.errorMessage, 'Detalhe do upload');
    assert.equal(registro.code, 'UPLOAD_FAILED');
    assert.equal(registro.etapa, 'upload-imagem');
    assert.equal(linhas[0].includes(String.fromCharCode(27)), false);
});
