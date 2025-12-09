const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET - Buscar todas as configurações
router.get('/', async (req, res) => {
    try {
        const [configuracoes] = await pool.query('SELECT * FROM configuracoes');
        
        // Converter array para objeto
        const configObj = {};
        configuracoes.forEach(config => {
            configObj[config.chave] = config.valor;
        });
        
        res.json(configObj);
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

// POST/PUT - Atualizar ou criar configuração
router.post('/', async (req, res) => {
    try {
        console.log('===== RECEBENDO CONFIGURAÇÕES =====');
        console.log('Body recebido:', req.body);
        const configuracoes = req.body;

        // Atualizar ou inserir cada configuração
        for (const [chave, valor] of Object.entries(configuracoes)) {
            console.log(`Salvando: ${chave} = ${valor}`);
            await pool.query(
                'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
                [chave, valor, valor]
            );
        }

        console.log('Todas configurações salvas com sucesso');

        // Buscar configurações atualizadas
        const [configsAtualizadas] = await pool.query('SELECT * FROM configuracoes');
        
        const configObj = {};
        configsAtualizadas.forEach(config => {
            configObj[config.chave] = config.valor;
        });
        
        console.log('Retornando configurações atualizadas:', configObj);
        res.json(configObj);
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

// PUT - Atualizar configuração específica
router.put('/:chave', async (req, res) => {
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
