const express = require('express');
const { z } = require('zod');
const { pool } = require('../config/database');
const { verificarAdminAuth } = require('../middleware/auth');
const { configuracaoPush, endpointPermitido } = require('../services/pushService');
const router = express.Router();
const idValido = valor => ['string', 'number'].includes(typeof valor) && /^[1-9]\d*$/.test(String(valor)) && Number(valor) <= 2147483647;
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(verificarAdminAuth);

function falha(res, erro) {
    if (erro.code === '42P01') return res.status(503).json({ error: 'Execute a migração de notificações no Neon para ativar esta área.', code: 'NOTIFICACOES_MIGRACAO_PENDENTE' });
    console.error('Erro nas notificações:', erro.code || erro.name);
    return res.status(500).json({ error: 'Não foi possível atualizar as notificações. Tente novamente.' });
}

const pendentesSql = `FROM notificacoes_pedidos n WHERE NOT EXISTS
    (SELECT 1 FROM notificacoes_leituras l WHERE l.notificacao_id = n.id AND l.usuario_id = $1)`;

router.get('/resumo', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS nao_lidas, COALESCE(MAX(n.id), 0)::int AS ultimo_id ${pendentesSql}`, [req.usuario.id]);
        res.json(rows[0]);
    } catch (erro) { falha(res, erro); }
});

router.get('/', async (req, res) => {
    const cursor = req.query.antes;
    if (cursor !== undefined && !idValido(cursor)) return res.status(400).json({ error: 'Página de notificações inválida' });
    try {
        const { rows } = await pool.query(`SELECT n.id, n.pedido_id, n.created_at, p.status, p.total,
            EXISTS (SELECT 1 FROM notificacoes_leituras l WHERE l.notificacao_id = n.id AND l.usuario_id = $1) AS lida
            FROM notificacoes_pedidos n JOIN pedidos p ON p.id = n.pedido_id
            WHERE ($2::int IS NULL OR n.id < $2) ORDER BY n.id DESC LIMIT 21`, [req.usuario.id, cursor || null]);
        res.json({ notificacoes: rows.slice(0, 20), proximo_cursor: rows.length > 20 ? rows[19].id : null });
    } catch (erro) { falha(res, erro); }
});

router.put('/lidas', async (req, res) => {
    if (!idValido(req.body.ate_id)) return res.status(400).json({ error: 'Informe a última notificação exibida' });
    try {
        await pool.query(`INSERT INTO notificacoes_leituras (notificacao_id, usuario_id)
            SELECT n.id, $1 FROM notificacoes_pedidos n WHERE n.id <= $2
            ON CONFLICT (notificacao_id, usuario_id) DO NOTHING`, [req.usuario.id, req.body.ate_id]);
        res.json({ success: true });
    } catch (erro) { falha(res, erro); }
});

router.put('/:id/lida', async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Notificação inválida' });
    try {
        const { rows } = await pool.query(`INSERT INTO notificacoes_leituras (notificacao_id, usuario_id)
            SELECT id, $1 FROM notificacoes_pedidos WHERE id = $2
            ON CONFLICT (notificacao_id, usuario_id) DO UPDATE SET lida_em = notificacoes_leituras.lida_em
            RETURNING notificacao_id`, [req.usuario.id, req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Notificação não encontrada' });
        res.json({ success: true });
    } catch (erro) { falha(res, erro); }
});

router.get('/push/config', (req, res) => {
    const config = configuracaoPush();
    res.json({ disponivel: Boolean(config), chave_publica: config?.publicKey || null });
});

router.put('/pedido/:id/lida', async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Pedido inválido' });
    try {
        await pool.query(`INSERT INTO notificacoes_leituras (notificacao_id, usuario_id)
            SELECT id, $1 FROM notificacoes_pedidos WHERE pedido_id = $2
            ON CONFLICT (notificacao_id, usuario_id) DO NOTHING`, [req.usuario.id, req.params.id]);
        res.json({ success: true });
    } catch (erro) { falha(res, erro); }
});

const inscricaoSchema = z.object({ endpoint: z.string().max(2048).refine(endpointPermitido),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().max(90).regex(/^[\w-]+={0,2}$/).refine(s => { const b = Buffer.from(s, 'base64url'); return b.length === 65 && b[0] === 4; }),
        auth: z.string().max(24).regex(/^[\w-]+={0,2}$/).refine(s => Buffer.from(s, 'base64url').length === 16) }) });

router.post('/push/inscricao', async (req, res) => {
    if (!configuracaoPush()) return res.status(503).json({ error: 'Push ainda não foi configurado na hospedagem' });
    const validacao = inscricaoSchema.safeParse(req.body);
    if (!validacao.success) return res.status(400).json({ error: 'Inscrição de dispositivo inválida' });
    const { endpoint, keys } = validacao.data;
    try {
        const { rows } = await pool.query(`INSERT INTO push_inscricoes (usuario_id, sessao_id, endpoint, p256dh, auth)
            SELECT $1, $2, $3, $4, $5 WHERE
                (SELECT COUNT(*) FROM push_inscricoes WHERE usuario_id = $1) < 10
                OR EXISTS (SELECT 1 FROM push_inscricoes WHERE endpoint = $3)
            ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, sessao_id = EXCLUDED.sessao_id,
                p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = CURRENT_TIMESTAMP RETURNING id`,
        [req.usuario.id, req.sessaoId, endpoint, keys.p256dh, keys.auth]);
        if (!rows.length) return res.status(429).json({ error: 'Limite de dez dispositivos por administrador atingido' });
        res.status(201).json({ success: true });
    } catch (erro) { falha(res, erro); }
});

router.delete('/push/inscricao', async (req, res) => {
    if (typeof req.body.endpoint !== 'string' || req.body.endpoint.length > 2048) return res.status(400).json({ error: 'Dispositivo inválido' });
    try {
        await pool.query('DELETE FROM push_inscricoes WHERE usuario_id = $1 AND endpoint = $2', [req.usuario.id, req.body.endpoint]);
        res.json({ success: true });
    } catch (erro) { falha(res, erro); }
});
module.exports = router;
