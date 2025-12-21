const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarAdminAuth } = require('../middleware/auth');

// GET - Buscar todas as configurações
router.get('/', async (req, res) => {
    try {
        const [configuracoes] = await pool.query('SELECT * FROM configuracoes LIMIT 1');
        
        if (configuracoes.length === 0) {
            return res.json({
                nome_site: '',
                titulo: '',
                descricao: '',
                telefone: '',
                email: '',
                endereco: '',
                whatsapp: '',
                instagram: '',
                facebook: ''
            });
        }
        
        res.json(configuracoes[0]);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// GET - Buscar configuração específica
router.get('/:chave', async (req, res) => {
    try {
        const [config] = await pool.query(
            'SELECT * FROM configuracoes WHERE chave = ?',
            [req.params.chave]
        );
        
        if (config.length === 0) {
            return res.status(404).json({ error: 'Configuração não encontrada' });
        }
        
        res.json({ chave: config[0].chave, valor: config[0].valor });
    } catch (error) {
        console.error('Erro ao buscar configuração:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração' });
    }
});

// POST/PUT - Atualizar ou criar configuração (apenas admin)
router.post('/', verificarAdminAuth, async (req, res) => {
    try {
        console.log('===== RECEBENDO CONFIGURAÇÕES =====');
        console.log('Body recebido:', req.body);
        const config = req.body;

        // Verificar se já existe configuração
        const [existing] = await pool.query('SELECT id FROM configuracoes LIMIT 1');
        
        if (existing.length > 0) {
            // Atualizar configuração existente
            await pool.query(
                `UPDATE configuracoes SET 
                    nome_site = ?,
                    titulo = ?,
                    descricao = ?,
                    telefone = ?,
                    email = ?,
                    endereco = ?,
                    whatsapp = ?,
                    instagram = ?,
                    facebook = ?
                WHERE id = ?`,
                [
                    config.nome_site || '',
                    config.titulo || '',
                    config.descricao || '',
                    config.telefone || '',
                    config.email || '',
                    config.endereco || '',
                    config.whatsapp || '',
                    config.instagram || '',
                    config.facebook || '',
                    existing[0].id
                ]
            );
        } else {
            // Inserir nova configuração
            await pool.query(
                `INSERT INTO configuracoes 
                (nome_site, titulo, descricao, telefone, email, endereco, whatsapp, instagram, facebook)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    config.nome_site || '',
                    config.titulo || '',
                    config.descricao || '',
                    config.telefone || '',
                    config.email || '',
                    config.endereco || '',
                    config.whatsapp || '',
                    config.instagram || '',
                    config.facebook || ''
                ]
            );
        }

        console.log('Configurações salvas com sucesso');

        // Buscar configurações atualizadas
        const [configsAtualizadas] = await pool.query('SELECT * FROM configuracoes LIMIT 1');
        
        console.log('Retornando configurações atualizadas:', configsAtualizadas[0]);
        res.json(configsAtualizadas[0]);
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações', details: error.message });
    }
});

// PUT - Atualizar configuração específica (apenas admin)
router.put('/:chave', verificarAdminAuth, async (req, res) => {
    try {
        const { valor } = req.body;
        const { chave } = req.params;

        await pool.query(
            'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
            [chave, valor, valor]
        );

        res.json({ chave, valor });
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
});

module.exports = router;
