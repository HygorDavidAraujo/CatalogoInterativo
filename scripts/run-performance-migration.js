// ===== SCRIPT PARA EXECUTAR MIGRATION DE ÍNDICES =====
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = {
    info: (msg) => console.log(`✓ ${msg}`),
    warn: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`)
};

async function runMigration() {
    let connection;
    
    try {
        logger.info('Iniciando migration de índices de performance...');
        
        // Configuração do banco
        const dbConfig = {
            host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
            user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
            database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'catalogo_vinhos',
            port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306'),
            multipleStatements: true
        };

        logger.info(`Conectando ao banco: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        
        // Criar conexão
        connection = await mysql.createConnection(dbConfig);
        logger.info('Conectado ao banco de dados');

        // Ler arquivo SQL
        const sqlFile = path.join(__dirname, '..', 'database', 'migration-performance-indexes.sql');
        logger.info(`Lendo arquivo: ${sqlFile}`);
        
        const sql = fs.readFileSync(sqlFile, 'utf8');

        // Executar SQL
        logger.info('Executando migration...');
        
        // Dividir por ponto e vírgula e executar um por vez (ignorar erros de índice duplicado)
        const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
        
        let successCount = 0;
        let skipCount = 0;
        
        for (const statement of statements) {
            const trimmed = statement.trim();
            if (!trimmed) continue;
            
            try {
                await connection.query(trimmed);
                successCount++;
                if (trimmed.startsWith('CREATE INDEX')) {
                    const indexName = trimmed.match(/CREATE INDEX (\w+)/)?.[1];
                    logger.info(`  ✓ Criado: ${indexName}`);
                }
            } catch (error) {
                // Ignorar erro de índice duplicado
                if (error.code === 'ER_DUP_KEYNAME') {
                    skipCount++;
                    const indexName = trimmed.match(/CREATE INDEX (\w+)/)?.[1];
                    logger.warn(`  ⚠️  Já existe: ${indexName}`);
                } else {
                    throw error;
                }
            }
        }
        
        logger.info('✅ Migration executada com sucesso!');
        logger.info(`📊 Resultados: ${successCount} criados, ${skipCount} já existiam`);
        
        // Mostrar índices criados
        logger.info('\n📊 Índices na tabela vinhos:');
        const [indexes] = await connection.query('SHOW INDEX FROM vinhos');
        indexes.forEach(idx => {
            if (idx.Key_name.startsWith('idx_')) {
                logger.info(`  - ${idx.Key_name} (${idx.Column_name})`);
            }
        });
        
        logger.info('\n✅ Migration concluída!');
        
    } catch (error) {
        logger.error(`Erro durante migration: ${error.message}`);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            logger.info('Conexão fechada');
        }
    }
}

// Executar
runMigration();
