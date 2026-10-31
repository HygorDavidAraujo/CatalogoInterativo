const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const requiredTables = [
    'vinhos',
    'configuracoes',
    'usuarios',
    'pedidos',
    'pedidos_itens',
    'beneficios_vip',
    'password_resets'
];

router.get('/setup', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = current_schema()
               AND table_name = ANY($1::text[])`,
            [requiredTables]
        );
        const existingTables = new Set(rows.map((row) => row.table_name));
        const missingTables = requiredTables.filter((table) => !existingTables.has(table));

        if (missingTables.length > 0) {
            return res.status(503).json({
                status: 'incomplete',
                database: 'PostgreSQL',
                missingTables,
                message: 'Execute database/schema.postgresql.sql no banco Neon.'
            });
        }

        res.json({ status: 'ready', database: 'PostgreSQL' });
    } catch (error) {
        console.error('Erro ao verificar o schema PostgreSQL:', error);
        res.status(500).json({ error: 'Erro ao verificar o banco de dados' });
    }
});

module.exports = router;
