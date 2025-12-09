const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'catalogo_vinhos',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// Testar conexão
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✓ Conexão com o banco de dados estabelecida com sucesso!');
        connection.release();
        return true;
    } catch (error) {
        console.error('✗ Erro ao conectar com o banco de dados:', error.message);
        return false;
    }
}

module.exports = { pool, testConnection };
