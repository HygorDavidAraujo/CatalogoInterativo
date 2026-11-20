const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');
const { verificarAdminAuth } = require('../middleware/auth');
const { ErroPedido } = require('../services/pedidoService');
const Pagamentos = require('../services/infinitepayService');
const { notificarPedido } = require('../services/pedidoEmailService');
const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const idSchema = z.coerce.number().int().min(1).max(2147483647);
const uuid = z.uuid();
const entregaSchema = z.object({ frete: z.union([z.string(), z.number()]).refine(v => /^\d+(\.\d{1,2})?$/.test(String(v))),
    entrega_tipo: z.enum(['entrega', 'retirada']), entrega_detalhes: z.string().trim().min(3).max(1000) }).strict();
const tapSchema = z.object({ payment_method: z.enum(['credit', 'debit']), installments: z.number().int().min(1).max(12),
    reabrir_sem_pagamento: z.boolean().optional() }).strict();
const referenciaSchema = z.object({ order_nsu: uuid, transaction_nsu: uuid,
    slug: z.string().regex(/^[a-zA-Z0-9_-]{1,255}$/) });

router.get('/pedidos/:id', verificarAdminAuth, tratar(async (req, res) => {
    const { rows } = await pool.query(`SELECT id, metodo, status, checkout_url, transaction_nsu,
        confirmacao, expira_em, pago_em FROM pagamentos WHERE pedido_id = $1`, [idSchema.parse(req.params.id)]);
    res.json({ pagamento: rows[0] || null });
}));

function tratar(handler) {
    return async (req, res) => {
        try { await handler(req, res); }
        catch (error) {
            if (error instanceof z.ZodError || error instanceof RangeError) return res.status(400).json({ error: 'Revise os dados informados.' });
            if (error instanceof ErroPedido) return res.status(error.statusCode).json({ error: error.message });
            if (error.code === '23505') return res.status(409).json({ error: 'Esta transação já está registrada em outra cobrança.' });
            if (['42P01', '42703'].includes(error.code)) return res.status(503).json({ error: 'Execute a migração de pagamentos no banco antes de usar esta função.' });
            console.error('[pagamentos] Operação não concluída:', error.code || error.name);
            res.status(500).json({ error: 'Não foi possível concluir a operação. Confira o pedido antes de tentar novamente.' });
        }
    };
}

router.get('/config', verificarAdminAuth, (req, res) => {
    try {
        const config = Pagamentos.configuracao();
        res.json({ checkout: Boolean(config.apiKey), tap: true, handle: config.handle });
    } catch (error) { res.json({ checkout: false, tap: false, mensagem: error.message }); }
});

router.put('/pedidos/:id/entrega', verificarAdminAuth, tratar(async (req, res) => {
    res.json(await Pagamentos.salvarEntrega(pool, idSchema.parse(req.params.id), entregaSchema.parse(req.body)));
}));

router.post('/pedidos/:id/checkout', verificarAdminAuth, tratar(async (req, res) => {
    const p = await Pagamentos.gerarCheckout(pool, idSchema.parse(req.params.id));
    res.json({ id: p.id, url: p.checkout_url, status: p.status, expira_em: p.expira_em });
}));

router.post('/pedidos/:id/tap', verificarAdminAuth, tratar(async (req, res) => {
    res.json(await Pagamentos.iniciarTap(pool, idSchema.parse(req.params.id), tapSchema.parse(req.body)));
}));

router.post('/pedidos/:id/tap/conferir', verificarAdminAuth, tratar(async (req, res) => {
    const dados = z.object({ transaction_nsu: uuid, conferido: z.literal(true) }).strict().parse(req.body);
    const resultado = await Pagamentos.conferirTap(pool, idSchema.parse(req.params.id), dados.transaction_nsu, req.usuario.id);
    if (resultado.novo) await notificarPedido(pool, resultado.pedidoId, { status: resultado.cancelado ? 'cancelado' : 'confirmado' });
    res.json({ pago: resultado.pago, cancelado: resultado.cancelado });
}));

const retornoLimiter = rateLimit({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Muitas consultas. Aguarde um minuto.' } });
async function receber(req, res, webhook) {
    const id = uuid.parse(webhook ? req.params.id : req.body.pagamento_id);
    const dados = referenciaSchema.parse({ ...req.body, slug: webhook ? req.body.invoice_slug : req.body.slug });
    const resultado = await Pagamentos.confirmar(pool, id, dados);
    if (resultado.novo) await notificarPedido(pool, resultado.pedidoId, { status: resultado.cancelado ? 'cancelado' : 'confirmado' });
    // Não expor pedido, cliente, produtos ou endereço no retorno público.
    res.json({ pago: resultado.pago, ...(resultado.cancelado ? { revisao: true } : {}) });
}
router.post('/confirmar', retornoLimiter, tratar((req, res) => receber(req, res, false)));
router.post('/webhook/:id', retornoLimiter, tratar((req, res) => receber(req, res, true)));
module.exports = router;
