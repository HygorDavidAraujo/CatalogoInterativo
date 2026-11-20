const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { randomBytes } = require('node:crypto');
const { pool } = require('../config/database');
const { verificarAdminAuth } = require('../middleware/auth');
const { calcularPedido, ErroPedido } = require('../services/pedidoService');
const { transacao } = require('../services/infinitepayService');
const router = express.Router();
router.use(verificarAdminAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const id = z.number().int().min(1).max(2147483647);
const clienteSchema = z.object({ nome_completo: z.string().trim().min(3).max(255),
    telefone: z.string().trim().regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/),
    email: z.email().max(255).transform(v => v.toLowerCase()) }).strict().transform(v => {
        const telefone = v.telefone.replace(/\D/g, '');
        return { ...v, telefone: `(${telefone.slice(0, 2)})${telefone.slice(2, -4)}-${telefone.slice(-4)}` };
    });
const vendaSchema = z.object({ chave_criacao: z.uuid(), cliente_id: id.optional(), cliente: clienteSchema.optional(),
    itens: z.array(z.object({ id, quantidade: z.number().int().min(1).max(999) }).strict()).min(1).max(100),
    observacoes: z.string().trim().max(1000).default('') }).strict()
    .refine(v => Boolean(v.cliente_id) !== Boolean(v.cliente), 'Selecione ou pré-cadastre um cliente');

router.get('/opcoes', async (req, res) => {
    try {
        const busca = z.string().max(150).parse(req.query.busca || '').trim();
        const [clientes, vinhos] = await Promise.all([
            pool.query(`SELECT id, nome_completo, telefone, email FROM usuarios WHERE is_admin = FALSE
                AND ($1 = '' OR POSITION(LOWER($1) IN LOWER(nome_completo || ' ' || email || ' ' || COALESCE(telefone,''))) > 0)
                ORDER BY nome_completo LIMIT 50`, [busca]),
            pool.query('SELECT id, nome, preco FROM vinhos WHERE ativo = TRUE ORDER BY nome')
        ]);
        res.json({ clientes: clientes.rows, vinhos: vinhos.rows });
    } catch { res.status(400).json({ error: 'Não foi possível carregar as opções da venda.' }); }
});

router.post('/', body('cliente.email').optional().isEmail().normalizeEmail(), async (req, res) => {
    try {
        if (!validationResult(req).isEmpty()) return res.status(400).json({ error: 'Informe um e-mail válido para o cliente.' });
        const dados = vendaSchema.parse(req.body);
        const resultado = await transacao(pool, async client => {
            // Idempotência inclusive em pré-cadastro: reenvio não cria outro cliente/pedido.
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [dados.chave_criacao]);
            const anterior = await client.query('SELECT id, vendedor_id FROM pedidos WHERE chave_criacao = $1', [dados.chave_criacao]);
            if (anterior.rows.length) {
                if (anterior.rows[0].vendedor_id !== req.usuario.id) throw new ErroPedido('Identificador da venda já utilizado.');
                return { pedidoId: anterior.rows[0].id };
            }
            let clienteId = dados.cliente_id;
            if (dados.cliente) {
                // Senha aleatória não é entregue nem compartilhada com o vendedor. O cliente
                // define sua senha depois pela recuperação de acesso do próprio e-mail.
                const senha = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);
                const { rows } = await client.query(`INSERT INTO usuarios (nome_completo, telefone, email, senha)
                    VALUES ($1,$2,$3,$4) RETURNING id`, [dados.cliente.nome_completo, dados.cliente.telefone, dados.cliente.email, senha]);
                clienteId = rows[0].id;
            }
            const cliente = await client.query('SELECT id FROM usuarios WHERE id = $1 AND is_admin = FALSE', [clienteId]);
            if (!cliente.rows.length) throw new ErroPedido('Selecione um cliente válido.', 400);
            const calculado = await calcularPedido(client, clienteId, dados.itens);
            const { rows } = await client.query(`INSERT INTO pedidos
                (usuario_id, total, observacoes, origem, vendedor_id, chave_criacao, frete, entrega_tipo, entrega_detalhes)
                VALUES ($1,$2,$3,'presencial',$4,$5,0,'retirada','Retirada presencial') RETURNING id`,
            [clienteId, calculado.total, dados.observacoes || null, req.usuario.id, dados.chave_criacao]);
            for (const i of calculado.itens) await client.query(`INSERT INTO pedidos_itens
                (pedido_id, vinho_id, vinho_nome, quantidade, preco_unitario, subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
            [rows[0].id, i.id, i.nome, i.quantidade, i.preco, i.subtotal]);
            return { pedidoId: rows[0].id, total: calculado.total };
        });
        res.status(201).json(resultado);
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Revise o cliente, o e-mail, o telefone e os itens da venda.' });
        if (error instanceof ErroPedido) return res.status(error.statusCode).json({ error: error.message });
        if (error.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado. Busque e selecione o cliente existente.' });
        if (['42P01', '42703'].includes(error.code)) return res.status(503).json({ error: 'Execute a migração de pagamentos no Neon.' });
        console.error('[vendas] Falha:', error.code || error.name);
        res.status(500).json({ error: 'Não foi possível registrar a venda. Tente novamente sem limpar o formulário.' });
    }
});
module.exports = router;
