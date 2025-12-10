const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do pool de conexões
// Prioriza variáveis Railway nativas (MYSQLHOST, etc), depois as personalizadas (DB_HOST, etc)
const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '79461382',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'catalogo_vinhos',
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306'),
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
