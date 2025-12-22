const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarAutenticacao, verificarAdminAuth } = require('../middleware/auth');
const { validatePedido, validatePedidoStatus, validateId } = require('../middleware/validators');

// GET - Listar pedidos de um cliente
router.get('/cliente/:clienteId', verificarAutenticacao, validateId, async (req, res) => {
    try {
        const { clienteId } = req.params;
        
        // Apenas o próprio usuário ou admin pode ver seus pedidos
        if (req.usuario.id !== Number(clienteId) && !req.usuario.isAdmin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        
        console.log('🔍 Buscando pedidos do cliente:', clienteId);
        
        // Buscar pedidos
        const [pedidos] = await pool.query(
            'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY created_at DESC',
            [clienteId]
        );

        console.log('📦 Pedidos encontrados:', pedidos.length);

        // Para cada pedido, buscar os itens
        for (let pedido of pedidos) {
            const [itens] = await pool.query(
                'SELECT * FROM pedidos_itens WHERE pedido_id = ?',
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
        const { usuario_id, total, itens, observacoes } = req.body;
        
        // Apenas o próprio usuário pode criar pedido para si
        if (req.usuario.id !== Number(usuario_id)) {
            return res.status(403).json({ error: 'Acesso negado: você só pode criar pedidos para sua conta' });
        }

        // Inserir pedido
        const [result] = await pool.query(
            'INSERT INTO pedidos (usuario_id, total, observacoes) VALUES (?, ?, ?)',
            [usuario_id, total, observacoes || null]
        );

        const pedidoId = result.insertId;

        // Inserir itens do pedido
        for (const item of itens) {
            await pool.query(
                'INSERT INTO pedidos_itens (pedido_id, vinho_id, vinho_nome, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [pedidoId, item.id, item.nome, item.quantidade, item.preco, item.preco * item.quantidade]
            );
        }

        res.status(201).json({ 
            success: true, 
            pedidoId,
            message: 'Pedido criado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({ error: 'Erro ao criar pedido' });
    }
});

// GET - Listar todos os pedidos (admin)
router.get('/', verificarAdminAuth, async (req, res) => {
    try {
        const [pedidos] = await pool.query(`
            SELECT p.*, u.nome_completo, u.email, u.telefone 
            FROM pedidos p 
            JOIN usuarios u ON p.usuario_id = u.id 
            ORDER BY p.created_at DESC
        `);

        for (let pedido of pedidos) {
            const [itens] = await pool.query(
                'SELECT * FROM pedidos_itens WHERE pedido_id = ?',
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

        await pool.query(
            'UPDATE pedidos SET status = ? WHERE id = ?',
            [status, id]
        );

        res.json({ success: true, message: 'Status atualizado' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

module.exports = router;
