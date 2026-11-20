const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { randomBytes } = require('node:crypto');
const { pool } = require('../config/database');
const { verificarAdminAuth } = require('../middleware/auth');
const { calcularPedido, ErroPedido } = require('../services/pedidoService');
const { transacao } = require('../services/infinitepayService');
const { aplicarDesconto } = require('../services/vendaService');
const Precos = require('../js/precos');
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
const itensSchema = z.array(z.object({ id, quantidade: z.number().int().min(1).max(999) }).strict()).min(1).max(100);
const descontoSchema = z.object({ tipo: z.enum(['valor', 'percentual']),
    valor: z.union([z.string().max(30), z.number()]) }).strict().default({ tipo: 'valor', valor: 0 });
const vendaSchema = z.object({ chave_criacao: z.uuid(), cliente_id: id.optional(), cliente: clienteSchema.optional(),
    itens: itensSchema, desconto: descontoSchema, total_previsto: z.union([z.string().max(30), z.number()]).optional(),
    observacoes: z.string().trim().max(1000).default('') }).strict()
    .refine(v => Boolean(v.cliente_id) !== Boolean(v.cliente), 'Selecione ou pré-cadastre um cliente');

function erroVenda(res, error) {
    if (error instanceof z.ZodError || error instanceof RangeError) return res.status(400).json({ error: 'Revise os dados do cliente, itens e desconto.' });
    if (error instanceof ErroPedido) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado. Busque e selecione o cliente existente.' });
    if (['42P01', '42703'].includes(error.code)) return res.status(503).json({ error: 'Execute a migração de descontos e pagamentos no Neon.' });
    console.error('[vendas] Falha:', error.code || error.name);
    res.status(500).json({ error: 'Não foi possível calcular ou registrar a venda. Tente novamente sem limpar o formulário.' });
}

router.post('/simular', async (req, res) => {
    try {
        const dados = z.object({ cliente_id: id.optional(), novo_cliente: z.literal(true).optional(),
            itens: itensSchema, desconto: descontoSchema }).strict()
            .refine(v => Boolean(v.cliente_id) !== Boolean(v.novo_cliente)).parse(req.body);
        const resultado = await transacao(pool, async client => {
            if (dados.cliente_id) {
                const cliente = await client.query('SELECT id FROM usuarios WHERE id = $1 AND is_admin = FALSE', [dados.cliente_id]);
                if (!cliente.rows.length) throw new ErroPedido('Selecione um cliente válido.', 400);
            }
            return aplicarDesconto(await calcularPedido(client, dados.cliente_id || null, dados.itens), dados.desconto);
        });
        res.json(resultado);
    } catch (error) { erroVenda(res, error); }
});

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
            const calculado = aplicarDesconto(await calcularPedido(client, clienteId, dados.itens), dados.desconto);
            if (dados.total_previsto !== undefined && Precos.paraCentavos(dados.total_previsto) !== Precos.paraCentavos(calculado.total)) {
                throw new ErroPedido('Os preços ou benefícios mudaram. Recalcule e confira o total antes de registrar a venda.');
            }
            const { rows } = await client.query(`INSERT INTO pedidos
                (usuario_id, total, observacoes, origem, vendedor_id, chave_criacao, frete, entrega_tipo, entrega_detalhes,
                desconto_manual, desconto_tipo, desconto_valor)
                VALUES ($1,$2,$3,'presencial',$4,$5,0,'retirada','Retirada presencial',$6,$7,$8) RETURNING id`,
            [clienteId, calculado.total, dados.observacoes || null, req.usuario.id, dados.chave_criacao,
                calculado.desconto_manual, calculado.desconto_tipo, calculado.desconto_valor]);
            for (const i of calculado.itens) await client.query(`INSERT INTO pedidos_itens
                (pedido_id, vinho_id, vinho_nome, quantidade, preco_unitario, subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
            [rows[0].id, i.id, i.nome, i.quantidade, i.preco, i.subtotal]);
            return { pedidoId: rows[0].id, total: calculado.total };
        });
        res.status(201).json(resultado);
    } catch (error) {
        erroVenda(res, error);
    }
});
module.exports = router;
