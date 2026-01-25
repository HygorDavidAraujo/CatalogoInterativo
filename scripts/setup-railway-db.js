// ===== SETUP COMPLETO DO RAILWAY DATABASE =====
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.railway' });

const logger = {
    info: (msg) => console.log(`✓ ${msg}`),
    warn: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`)
};

async function setupRailwayDB() {
    let connection;
    
    try {
        logger.info('🚀 Iniciando setup do Railway Database...');
        
        // Configuração do banco Railway
        const dbConfig = {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQLDATABASE,
            port: parseInt(process.env.MYSQLPORT),
            multipleStatements: true
        };

        if (!dbConfig.host || !dbConfig.user || !dbConfig.password) {
            throw new Error('Credenciais do Railway não configuradas em .env.railway');
        }

        logger.info(`Conectando ao Railway: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        
        // Criar conexão
        connection = await mysql.createConnection(dbConfig);
        logger.info('✓ Conectado ao Railway MySQL');

        // 1. Executar schema base (tabelas)
        logger.info('\n📊 Executando schema base...');
        const schemaFile = path.join(__dirname, '..', 'database', 'schema.sql');
        let schemaSql = fs.readFileSync(schemaFile, 'utf8');
        
        // Remover "CREATE DATABASE" pois o Railway já tem o database "railway"
        schemaSql = schemaSql.replace(/CREATE DATABASE.*?;/gi, '');
        schemaSql = schemaSql.replace(/USE.*?;/gi, '');
        
        // Executar schema
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        let tablesCreated = 0;
        for (const statement of statements) {
            try {
                await connection.query(statement);
                if (statement.toUpperCase().includes('CREATE TABLE')) {
                    tablesCreated++;
                    const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?/i)?.[1];
                    logger.info(`  ✓ Tabela criada: ${tableName}`);
                }
            } catch (error) {
                if (error.code === 'ER_TABLE_EXISTS_BASE') {
                    continue; // Já existe
                }
                logger.warn(`  ⚠️  ${error.message}`);
            }
        }
        logger.info(`✓ Schema base: ${tablesCreated} tabelas processadas`);

        // 2. Executar migration de índices de performance
        logger.info('\n🚀 Executando migration de índices de performance...');
        const migrationFile = path.join(__dirname, '..', 'database', 'migration-performance-indexes.sql');
        const migrationSql = fs.readFileSync(migrationFile, 'utf8');
        
        const indexStatements = migrationSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let indexesCreated = 0;
        let indexesExisted = 0;

        for (const statement of indexStatements) {
            try {
                await connection.query(statement);
                indexesCreated++;
                const indexName = statement.match(/INDEX\s+(\w+)/i)?.[1];
                logger.info(`  ✓ Índice criado: ${indexName}`);
            } catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    indexesExisted++;
                } else {
                    logger.warn(`  ⚠️  ${error.message}`);
                }
            }
        }

        logger.info(`✓ Índices: ${indexesCreated} criados, ${indexesExisted} já existiam`);

        // 3. Verificar tabelas criadas
        logger.info('\n📋 Verificando tabelas criadas...');
        const [tables] = await connection.query('SHOW TABLES');
        logger.info(`✓ Total de tabelas: ${tables.length}`);
        tables.forEach(row => {
            const tableName = Object.values(row)[0];
            logger.info(`  - ${tableName}`);
        });

        // 4. Verificar índices
        logger.info('\n🔍 Verificando índices criados...');
        const [indexes] = await connection.query(`
            SELECT DISTINCT TABLE_NAME, INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = ? 
            AND INDEX_NAME != 'PRIMARY'
            ORDER BY TABLE_NAME, INDEX_NAME
        `, [dbConfig.database]);
        
        logger.info(`✓ Total de índices: ${indexes.length}`);
        indexes.forEach(idx => {
            logger.info(`  - ${idx.TABLE_NAME}.${idx.INDEX_NAME}`);
        });

        logger.info('\n✅ Setup do Railway Database concluído com sucesso!');
        logger.info('🚀 Você pode fazer o deploy agora!');

    } catch (error) {
        logger.error(`Erro no setup: ${error.message}`);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            logger.info('\n🔌 Conexão encerrada');
        }
    }
}

// Executar
setupRailwayDB()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
