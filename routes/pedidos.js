const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarAutenticacao, verificarAdminAuth } = require('../middleware/auth');
const { validatePedido, validatePedidoStatus, validateId, validateClienteId } = require('../middleware/validators');
const { calcularPedido, ErroPedido } = require('../services/pedidoService');
const PedidoStatus = require('../js/pedido-status');
const { notificarPedido } = require('../services/pedidoEmailService');

// GET - Listar pedidos de um cliente
router.get('/cliente/:clienteId', verificarAutenticacao, validateClienteId, async (req, res) => {
    try {
        const { clienteId } = req.params;
        
        // Apenas o próprio usuário ou admin pode ver seus pedidos
        if (req.usuario.id !== Number(clienteId) && !req.usuario.isAdmin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        
        console.log('🔍 Buscando pedidos do cliente:', clienteId);
        
        // Buscar pedidos
        const { rows: pedidos } = await pool.query(
            'SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY created_at DESC',
            [clienteId]
        );

        console.log('📦 Pedidos encontrados:', pedidos.length);

        // Para cada pedido, buscar os itens
        for (let pedido of pedidos) {
            pedido.status = PedidoStatus.normalizar(pedido.status);
            const { rows: itens } = await pool.query(
                'SELECT * FROM pedidos_itens WHERE pedido_id = $1',
                [pedido.id]
            );
            pedido.itens = itens;
            console.log(`  Pedido #${pedido.id}: ${itens.length} itens`);
        }

        console.log('✅ Enviando resposta com', pedidos.length, 'pedidos');
        res.json(pedidos);
    } catch (error) {
        console.error('❌ Erro ao buscar pedidos:', error);
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
});

// POST - Criar novo pedido (autenticado)
router.post('/', verificarAutenticacao, validatePedido, async (req, res) => {
    try {
        const { usuario_id, itens, observacoes } = req.body;
        const usuarioId = req.usuario.id;
        
        // Apenas o próprio usuário pode criar pedido para si
        if (usuario_id !== undefined && usuarioId !== Number(usuario_id)) {
            return res.status(403).json({ error: 'Acesso negado: você só pode criar pedidos para sua conta' });
        }

        const client = await pool.connect();
        let pedidoId;
        let pedidoCalculado;
        try {
            await client.query('BEGIN');
            pedidoCalculado = await calcularPedido(client, usuarioId, itens);
            const result = await client.query(
                'INSERT INTO pedidos (usuario_id, total, observacoes) VALUES ($1, $2, $3) RETURNING id',
                [usuarioId, pedidoCalculado.total, observacoes || null]
            );
            pedidoId = result.rows[0].id;

            for (const item of pedidoCalculado.itens) {
                await client.query(
                    'INSERT INTO pedidos_itens (pedido_id, vinho_id, vinho_nome, quantidade, preco_unitario, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
                    [pedidoId, item.id, item.nome, item.quantidade, item.preco, item.subtotal]
                );
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        await notificarPedido(pool, pedidoId, { novo: true });

        res.status(201).json({ 
            success: true, 
            pedidoId,
            total: pedidoCalculado.total,
            itens: pedidoCalculado.itens,
            message: 'Pedido criado com sucesso' 
        });
    } catch (error) {
        if (error instanceof ErroPedido) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({ error: 'Erro ao criar pedido' });
    }
});

// Fila operacional: consultas limitadas, sem carregar todos os itens a cada atualização.
const statusSql = `CASE p.status WHEN 'processando' THEN 'em_preparacao'
    WHEN 'enviado' THEN 'em_rota_entrega' WHEN 'entregue' THEN 'finalizado' ELSE p.status END`;
function semCache(req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    next();
}

router.get('/resumo', verificarAdminAuth, semCache, async (req, res) => {
    try {
        const [contagem, recentes] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ${statusSql} NOT IN ('finalizado', 'cancelado'))::int AS em_aberto
                FROM pedidos p`),
            pool.query('SELECT id FROM pedidos ORDER BY id DESC LIMIT 50')
        ]);
        res.json({ ...contagem.rows[0], recentes: recentes.rows.map(p => p.id) });
    } catch (error) {
        console.error('Erro ao resumir pedidos:', error);
        res.status(500).json({ error: 'Erro ao atualizar notificações de pedidos' });
    }
});

router.get('/recebidos', verificarAdminAuth, semCache, async (req, res) => {
    const pagina = String(req.query.pagina ?? '1');
    const status = req.query.status ?? '';
    const busca = req.query.busca ?? '';
    if (!/^[1-9]\d{0,5}$/.test(pagina) || typeof busca !== 'string' || busca.length > 150 ||
        typeof status !== 'string' || (status && status !== 'abertos' && !PedidoStatus.valores.includes(status))) {
        return res.status(400).json({ error: 'Filtros de pedidos inválidos' });
    }
    try {
        const termo = busca.trim();
        const where = `WHERE ($1 = '' OR ($1 = 'abertos' AND ${statusSql} NOT IN ('finalizado', 'cancelado'))
            OR ${statusSql} = $1)
            AND ($2 = '' OR POSITION(LOWER($2) IN LOWER(u.nome_completo)) > 0
                OR POSITION(LOWER($2) IN LOWER(u.email)) > 0 OR p.id::text = $2)`;
        const params = [status, termo];
        const { rows: contagem } = await pool.query(`SELECT COUNT(*)::int AS total FROM pedidos p
            JOIN usuarios u ON u.id = p.usuario_id ${where}`, params);
        const { rows } = await pool.query(`SELECT p.id, p.usuario_id, p.total, p.status, p.created_at,
            u.nome_completo FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id ${where}
            ORDER BY p.created_at DESC, p.id DESC LIMIT 20 OFFSET $3`, [...params, (Number(pagina) - 1) * 20]);
        res.json({ pedidos: rows.map(p => ({ ...p, status: PedidoStatus.normalizar(p.status) })),
            total: contagem[0].total, pagina: Number(pagina), por_pagina: 20 });
    } catch (error) {
        console.error('Erro ao listar fila de pedidos:', error);
        res.status(500).json({ error: 'Erro ao listar pedidos recebidos' });
    }
});

router.get('/:id', verificarAdminAuth, semCache, validateId, async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT p.*, u.nome_completo, u.email, u.telefone,
            COALESCE((SELECT json_agg(i ORDER BY i.id) FROM pedidos_itens i WHERE i.pedido_id = p.id), '[]'::json) AS itens
            FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = $1`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
        res.json({ ...rows[0], status: PedidoStatus.normalizar(rows[0].status) });
    } catch (error) {
        console.error('Erro ao detalhar pedido:', error);
        res.status(500).json({ error: 'Erro ao carregar pedido' });
    }
});

// GET - Listar todos os pedidos (admin)
router.get('/', verificarAdminAuth, async (req, res) => {
    try {
        const { rows: pedidos } = await pool.query(`
            SELECT p.*, u.nome_completo, u.email, u.telefone 
            FROM pedidos p 
            JOIN usuarios u ON p.usuario_id = u.id 
            ORDER BY p.created_at DESC
        `);

        for (let pedido of pedidos) {
            pedido.status = PedidoStatus.normalizar(pedido.status);
            const { rows: itens } = await pool.query(
                'SELECT * FROM pedidos_itens WHERE pedido_id = $1',
                [pedido.id]
            );
            pedido.itens = itens;
        }

        res.json(pedidos);
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        res.status(500).json({ error: 'Erro ao listar pedidos' });
    }
});

// PUT - Atualizar status do pedido (apenas admin)
router.put('/:id/status', verificarAdminAuth, validateId, validatePedidoStatus, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const { rows } = await pool.query(
            `WITH anterior AS (
                SELECT id, status FROM pedidos WHERE id = $2 FOR UPDATE
            )
            UPDATE pedidos p SET status = $1 FROM anterior a WHERE p.id = a.id
            RETURNING p.id, p.status, a.status AS status_anterior`,
            [status, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        if (PedidoStatus.normalizar(rows[0].status_anterior) !== rows[0].status) {
            await notificarPedido(pool, rows[0].id, { status: rows[0].status });
        }
        res.json({ success: true, message: 'Status atualizado', pedidoId: rows[0].id, status: rows[0].status });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

module.exports = router;
