// ===== MIGRAÇÃO COMPLETA: LOCAL → RAILWAY =====
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const logger = {
    info: (msg) => console.log(`✓ ${msg}`),
    warn: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`)
};

async function migrateToRailway() {
    let localConn, railwayConn;
    
    try {
        logger.section('🚀 MIGRAÇÃO: Banco Local → Railway');

        // ===== CONFIGURAÇÕES =====
        // Banco LOCAL
        require('dotenv').config({ path: '.env.local' });
        const localConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT)
        };

        // Banco RAILWAY
        require('dotenv').config({ path: '.env.railway', override: true });
        const railwayConfig = {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQLDATABASE,
            port: parseInt(process.env.MYSQLPORT)
        };

        // ===== VALIDAÇÕES =====
        if (!localConfig.host || !localConfig.database) {
            throw new Error('Credenciais do banco LOCAL não configuradas em .env.local');
        }
        if (!railwayConfig.host || !railwayConfig.password) {
            throw new Error('Credenciais do Railway não configuradas em .env.railway');
        }

        // ===== CONECTAR BANCOS =====
        logger.info('Conectando ao banco LOCAL...');
        localConn = await mysql.createConnection(localConfig);
        logger.info(`✓ Local: ${localConfig.database}@${localConfig.host}`);

        logger.info('Conectando ao banco RAILWAY...');
        railwayConn = await mysql.createConnection(railwayConfig);
        logger.info(`✓ Railway: ${railwayConfig.database}@${railwayConfig.host}`);

        // ===== BACKUP DE SEGURANÇA =====
        logger.section('📦 BACKUP DE SEGURANÇA');
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = path.join(backupDir, `pre-migration-${timestamp}.json`);
        
        // ===== TABELAS A MIGRAR =====
        const tables = ['vinhos', 'usuarios', 'pedidos', 'pedidos_itens', 'configuracoes'];
        const allData = {};

        logger.info('Exportando dados do banco local...');
        
        for (const table of tables) {
            try {
                const [rows] = await localConn.query(`SELECT * FROM ${table}`);
                allData[table] = rows;
                logger.info(`  ✓ ${table}: ${rows.length} registros`);
            } catch (error) {
                if (error.code === 'ER_NO_SUCH_TABLE') {
                    logger.warn(`  ⚠️  Tabela ${table} não existe no banco local`);
                    allData[table] = [];
                } else {
                    throw error;
                }
            }
        }

        // Salvar backup
        fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
        logger.info(`✓ Backup salvo em: ${backupFile}`);

        // ===== CRIAR ESTRUTURA NO RAILWAY =====
        logger.section('🏗️  CRIANDO ESTRUTURA NO RAILWAY');
        
        const schemaFile = path.join(__dirname, '..', 'database', 'schema.sql');
        let schemaSql = fs.readFileSync(schemaFile, 'utf8');
        
        // Remover comandos que não são necessários
        schemaSql = schemaSql.replace(/CREATE DATABASE.*?;/gi, '');
        schemaSql = schemaSql.replace(/USE.*?;/gi, '');
        schemaSql = schemaSql.replace(/INSERT INTO.*?;/gis, ''); // Não inserir dados de exemplo
        
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            try {
                await railwayConn.query(statement);
                if (statement.toUpperCase().includes('CREATE TABLE')) {
                    const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?/i)?.[1];
                    logger.info(`  ✓ Tabela criada: ${tableName}`);
                }
            } catch (error) {
                if (error.code === 'ER_TABLE_EXISTS_BASE') {
                    // Tabela já existe
                } else {
                    logger.warn(`  ⚠️  ${error.message}`);
                }
            }
        }

        // ===== CRIAR ÍNDICES DE PERFORMANCE =====
        logger.section('🚀 CRIANDO ÍNDICES DE PERFORMANCE');
        
        const indexFile = path.join(__dirname, '..', 'database', 'migration-performance-indexes.sql');
        const indexSql = fs.readFileSync(indexFile, 'utf8');
        
        const indexStatements = indexSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let indexesCreated = 0;
        for (const statement of indexStatements) {
            try {
                await railwayConn.query(statement);
                indexesCreated++;
                const indexName = statement.match(/INDEX\s+(\w+)/i)?.[1];
                logger.info(`  ✓ Índice criado: ${indexName}`);
            } catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    // Índice já existe
                } else {
                    logger.warn(`  ⚠️  ${error.message}`);
                }
            }
        }
        logger.info(`✓ ${indexesCreated} índices criados`);

        // ===== MIGRAR DADOS =====
        logger.section('📊 MIGRANDO DADOS');

        let totalMigrated = 0;

        for (const table of tables) {
            const data = allData[table];
            
            if (!data || data.length === 0) {
                logger.warn(`  ⚠️  ${table}: sem dados para migrar`);
                continue;
            }

            logger.info(`Migrando ${table}...`);

            // Limpar tabela no Railway (opcional - comente se quiser manter dados existentes)
            // await railwayConn.query(`DELETE FROM ${table}`);

            let migrated = 0;
            let errors = 0;

            for (const row of data) {
                try {
                    const columns = Object.keys(row).filter(k => row[k] !== undefined);
                    const values = columns.map(k => row[k]);
                    const placeholders = columns.map(() => '?').join(', ');
                    
                    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
                                 ON DUPLICATE KEY UPDATE ${columns.map(c => `${c}=VALUES(${c})`).join(', ')}`;
                    
                    await railwayConn.query(sql, values);
                    migrated++;
                } catch (error) {
                    errors++;
                    if (errors <= 3) { // Mostrar apenas os 3 primeiros erros
                        logger.warn(`    ⚠️  Erro ao migrar registro: ${error.message}`);
                    }
                }
            }

            logger.info(`  ✓ ${table}: ${migrated} registros migrados${errors > 0 ? `, ${errors} erros` : ''}`);
            totalMigrated += migrated;
        }

        // ===== VERIFICAÇÃO FINAL =====
        logger.section('🔍 VERIFICAÇÃO FINAL');

        for (const table of tables) {
            try {
                const [rows] = await railwayConn.query(`SELECT COUNT(*) as total FROM ${table}`);
                const total = rows[0].total;
                const original = allData[table]?.length || 0;
                
                if (total === original) {
                    logger.info(`  ✓ ${table}: ${total} registros (100% migrado)`);
                } else {
                    logger.warn(`  ⚠️  ${table}: ${total} registros (esperado: ${original})`);
                }
            } catch (error) {
                logger.warn(`  ⚠️  ${table}: erro ao verificar`);
            }
        }

        logger.section('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
        logger.info(`📦 Backup: ${backupFile}`);
        logger.info(`📊 Total migrado: ${totalMigrated} registros`);
        logger.info('🚀 Você pode fazer o deploy no Railway agora!');

    } catch (error) {
        logger.error(`Erro na migração: ${error.message}`);
        logger.error('Stack:', error.stack);
        throw error;
    } finally {
        if (localConn) await localConn.end();
        if (railwayConn) await railwayConn.end();
        logger.info('\n🔌 Conexões encerradas');
    }
}

// Executar
migrateToRailway()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
