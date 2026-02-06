const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarAdminAuth } = require('../middleware/auth');

// GET - Listar todos os benefícios VIP
router.get('/', async (req, res) => {
    try {
        const [beneficios] = await pool.query(
            'SELECT * FROM beneficios_vip WHERE ativo = TRUE ORDER BY ordem ASC'
        );
        res.json(beneficios);
    } catch (error) {
        console.error('Erro ao buscar benefícios:', error);
        res.status(500).json({ error: 'Erro ao buscar benefícios' });
    }
});

// GET - Buscar benefício por slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const [beneficios] = await pool.query(
            'SELECT * FROM beneficios_vip WHERE slug = ? AND ativo = TRUE',
            [req.params.slug]
        );
        
        if (beneficios.length === 0) {
            return res.status(404).json({ error: 'Benefício não encontrado' });
        }
        
        res.json(beneficios[0]);
    } catch (error) {
        console.error('Erro ao buscar benefício:', error);
        res.status(500).json({ error: 'Erro ao buscar benefício' });
    }
});

// POST - Criar novo benefício (apenas admin)
router.post('/', verificarAdminAuth, async (req, res) => {
    try {
        const { nome, slug, tipo_desconto, valor_desconto, ordem } = req.body;
        
        // Validações
        if (!nome || !slug || !tipo_desconto || valor_desconto === undefined) {
            return res.status(400).json({ error: 'Campos obrigatórios: nome, slug, tipo_desconto, valor_desconto' });
        }

        if (!['percentual', 'valor_fixo'].includes(tipo_desconto)) {
            return res.status(400).json({ error: 'tipo_desconto deve ser "percentual" ou "valor_fixo"' });
        }

        const [result] = await pool.query(
            'INSERT INTO beneficios_vip (nome, slug, tipo_desconto, valor_desconto, ordem) VALUES (?, ?, ?, ?, ?)',
            [nome, slug, tipo_desconto, parseFloat(valor_desconto), ordem || 0]
        );

        res.status(201).json({
            success: true,
            id: result.insertId,
            message: 'Benefício criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar benefício:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Nome ou slug já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar benefício' });
    }
});

// PUT - Atualizar benefício (apenas admin)
router.put('/:id', verificarAdminAuth, async (req, res) => {
    try {
        const { nome, slug, tipo_desconto, valor_desconto, ordem } = req.body;
        const { id } = req.params;

        const [result] = await pool.query(
            'UPDATE beneficios_vip SET nome = ?, slug = ?, tipo_desconto = ?, valor_desconto = ?, ordem = ? WHERE id = ?',
            [nome, slug, tipo_desconto, parseFloat(valor_desconto), ordem || 0, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Benefício não encontrado' });
        }

        res.json({ success: true, message: 'Benefício atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar benefício:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Nome ou slug já existe' });
        }
        res.status(500).json({ error: 'Erro ao atualizar benefício' });
    }
});

// DELETE - Desativar benefício (soft delete)
router.delete('/:id', verificarAdminAuth, async (req, res) => {
    try {
        const [result] = await pool.query(
            'UPDATE beneficios_vip SET ativo = FALSE WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Benefício não encontrado' });
        }

        res.json({ success: true, message: 'Benefício desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar benefício:', error);
        res.status(500).json({ error: 'Erro ao deletar benefício' });
    }
});

module.exports = router;
