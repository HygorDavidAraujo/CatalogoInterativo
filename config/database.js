const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definido. Configure a connection string do PostgreSQL.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : undefined,
    max: process.env.VERCEL ? 5 : 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
});

pool.on('error', (error) => {
    console.error('Erro inesperado no pool PostgreSQL:', error);
});

async function testConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('✓ Conexão com o banco de dados estabelecida com sucesso!');
        return true;
    } catch (error) {
        console.error('✗ Erro ao conectar com o banco de dados:', error.message);
        return false;
    }
}

module.exports = { pool, testConnection };
