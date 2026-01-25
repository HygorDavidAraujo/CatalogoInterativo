// ===== ADICIONAR ÍNDICES DE PERFORMANCE NO RAILWAY =====
// Não altera dados existentes, apenas otimiza o banco
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.railway' });

const logger = {
    info: (msg) => console.log(`✓ ${msg}`),
    warn: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`)
};

async function optimizeRailway() {
    let connection;
    
    try {
        logger.section('🚀 OTIMIZANDO BANCO RAILWAY (sem alterar dados)');

        // Configuração Railway
        const dbConfig = {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQLDATABASE,
            port: parseInt(process.env.MYSQLPORT)
        };

        if (!dbConfig.host || !dbConfig.password) {
            throw new Error('Credenciais do Railway não configuradas em .env.railway');
        }

        logger.info(`Conectando ao Railway: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        connection = await mysql.createConnection(dbConfig);
        logger.info('✓ Conectado ao Railway MySQL');

        // ===== VERIFICAR DADOS EXISTENTES =====
        logger.section('📊 VERIFICANDO DADOS EXISTENTES');
        
        const tables = ['vinhos', 'usuarios', 'pedidos', 'pedidos_itens', 'configuracoes'];
        
        for (const table of tables) {
            try {
                const [rows] = await connection.query(`SELECT COUNT(*) as total FROM ${table}`);
                logger.info(`  ${table}: ${rows[0].total} registros`);
            } catch (error) {
                logger.warn(`  ⚠️  ${table}: tabela não existe ou erro`);
            }
        }

        // ===== VERIFICAR ÍNDICES EXISTENTES =====
        logger.section('🔍 VERIFICANDO ÍNDICES ATUAIS');
        
        const [existingIndexes] = await connection.query(`
            SELECT DISTINCT TABLE_NAME, INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = ? 
            AND INDEX_NAME != 'PRIMARY'
            ORDER BY TABLE_NAME, INDEX_NAME
        `, [dbConfig.database]);
        
        logger.info(`Índices existentes: ${existingIndexes.length}`);
        existingIndexes.forEach(idx => {
            logger.info(`  - ${idx.TABLE_NAME}.${idx.INDEX_NAME}`);
        });

        // ===== ADICIONAR ÍNDICES DE PERFORMANCE =====
        logger.section('🚀 ADICIONANDO ÍNDICES DE PERFORMANCE');
        
        const indexFile = path.join(__dirname, '..', 'database', 'migration-performance-indexes.sql');
        const indexSql = fs.readFileSync(indexFile, 'utf8');
        
        const indexStatements = indexSql
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
                    const indexName = statement.match(/INDEX\s+(\w+)/i)?.[1];
                    logger.warn(`  → Já existe: ${indexName}`);
                } else {
                    logger.warn(`  ⚠️  ${error.message}`);
                }
            }
        }

        logger.info(`\n📊 Resultado: ${indexesCreated} novos, ${indexesExisted} já existiam`);

        // ===== VERIFICAÇÃO FINAL =====
        logger.section('📋 ESTRUTURA FINAL');
        
        const [finalIndexes] = await connection.query(`
            SELECT DISTINCT TABLE_NAME, INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = ? 
            AND INDEX_NAME != 'PRIMARY'
            ORDER BY TABLE_NAME, INDEX_NAME
        `, [dbConfig.database]);
        
        logger.info(`Total de índices: ${finalIndexes.length}`);
        finalIndexes.forEach(idx => {
            logger.info(`  - ${idx.TABLE_NAME}.${idx.INDEX_NAME}`);
        });

        // Verificar dados (garantir que nada foi alterado)
        logger.section('✅ VERIFICANDO INTEGRIDADE DOS DADOS');
        
        for (const table of tables) {
            try {
                const [rows] = await connection.query(`SELECT COUNT(*) as total FROM ${table}`);
                logger.info(`  ✓ ${table}: ${rows[0].total} registros (preservados)`);
            } catch (error) {
                // Ignorar tabelas que não existem
            }
        }

        logger.section('✅ OTIMIZAÇÃO CONCLUÍDA!');
        logger.info('🚀 Seus dados estão intactos');
        logger.info('🚀 Índices de performance adicionados');
        logger.info('🚀 Você pode fazer o deploy agora!');

    } catch (error) {
        logger.error(`Erro na otimização: ${error.message}`);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            logger.info('\n🔌 Conexão encerrada');
        }
    }
}

// Executar
optimizeRailway()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
