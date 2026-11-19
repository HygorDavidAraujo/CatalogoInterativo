const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { vinhoSchema } = require('../middleware/validatorsZod');
const root = path.join(__dirname, '..');
const valido = { nome: 'VIP Ouro', slug: 'ouro', tipo_desconto: 'percentual', valor_desconto: '7.00', cor: '#FFD700', ordem: 0 };

function api() {
    const queries = [];
    const filename = path.join(root, 'routes/beneficios.js');
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, console,
        require: name => name === '../config/database'
            ? { pool: { async query(sql, params) { queries.push({ sql, params }); return { rows: [{ id: 1 }], rowCount: 1 }; } } }
            : name === '../middleware/auth'
                ? { verificarAdminAuth(req, res, next) {
                    if (req.headers.authorization === 'Bearer admin') return next();
                    return res.status(req.headers.authorization ? 403 : 401).json({ error: 'Sem permissão' });
                } } : localRequire(name)
    }, { filename });
    async function request(method, url, body, token = 'admin') {
        const req = { method, url, headers: token ? { authorization: 'Bearer ' + token } : {}, body, params: {}, query: {} };
        return new Promise((resolve, reject) => {
            const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
                json(data) { resolve({ status: this.statusCode, body: data }); } };
            module.exports.handle(req, res, error => reject(error || new Error('Rota não encontrada')));
        });
    }
    return { request, queries };
}

for (const [campo, valor] of [
    ['valor_desconto', '-1'], ['valor_desconto', '100.01'], ['valor_desconto', '7.001'], ['valor_desconto', ''],
    ['valor_desconto', null], ['valor_desconto', true], ['valor_desconto', 'abc'], ['valor_desconto', Infinity],
    ['tipo_desconto', 'inexistente'], ['slug', 'ou ro'], ['nome', ' '], ['cor', 'red;background:url(x)'], ['ordem', -1], ['ordem', 1.5]
]) {
    test(`benefício inválido é recusado no cadastro e edição: ${campo}=${String(valor)}`, async () => {
        const sistema = api();
        for (const [method, url] of [['POST', '/'], ['PUT', '/1']]) {
            const result = await sistema.request(method, url, { ...valido, [campo]: valor });
            assert.equal(result.status, 400);
            assert.ok(result.body.errors.length);
        }
        assert.equal(sistema.queries.length, 0);
    });
}

test('percentuais nos limites e descontos fixos válidos são persistidos sem parseFloat permissivo', async () => {
    const sistema = api();
    for (const valor_desconto of ['0.00', '7.50', '100.00']) {
        assert.equal((await sistema.request('POST', '/', { ...valido, valor_desconto })).status, 201);
    }
    assert.equal((await sistema.request('PUT', '/1', { ...valido, tipo_desconto: 'valor_fixo', valor_desconto: '150.00' })).status, 200);
    assert.equal(sistema.queries[1].params[3], 7.5);
    assert.equal(sistema.queries[3].params[3], 150);
});

test('escritas de benefícios exigem administrador e IDs válidos', async () => {
    const sistema = api();
    for (const [method, url] of [['POST', '/'], ['PUT', '/1'], ['DELETE', '/1']]) {
        assert.equal((await sistema.request(method, url, valido, null)).status, 401);
        assert.equal((await sistema.request(method, url, valido, 'cliente')).status, 403);
    }
    for (const id of ['0', 'abc', '2147483648']) {
        assert.equal((await sistema.request('PUT', '/' + id, valido)).status, 400);
        assert.equal((await sistema.request('DELETE', '/' + id)).status, 400);
    }
    assert.equal(sistema.queries.length, 0);
});

test('tipos de produto da API correspondem à restrição do schema PostgreSQL', () => {
    const sql = fs.readFileSync(path.join(root, 'database/schema.postgresql.sql'), 'utf8');
    const tiposBanco = [...sql.match(/tipo IN \(([^)]+)\)/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
    assert.deepEqual([...vinhoSchema.shape.tipo.options].sort(), tiposBanco.sort());
});
