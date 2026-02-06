const mysql = require('mysql2/promise');

// Use Railway credentials
const host = 'shinkansen.proxy.rlwy.net';
const user = 'root';
const password = 'MmAfPhyjxuZDBtuwVZilwfXoIPPQJOyT';
const database = 'railway';
const port = 17740;

async function adicionarColunaLogo() {
    const pool = mysql.createPool({
        host,
        user,
        password,
        database,
        port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('🔌 Conectando ao banco de dados...');
        const connection = await pool.getConnection();
        console.log('✅ Conectado ao banco de dados da Railway');

        // Verificar se as colunas já existem
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'configuracoes' 
            AND TABLE_SCHEMA = '${database}'
        `);

        const columnNames = columns.map(col => col.COLUMN_NAME);
        console.log('Colunas existentes:', columnNames);

        // Adicionar coluna logo_url se não existir
        if (!columnNames.includes('logo_url')) {
            console.log('📝 Adicionando coluna logo_url...');
            await connection.query(`
                ALTER TABLE configuracoes 
                ADD COLUMN logo_url VARCHAR(500) NULL 
                DEFAULT NULL
            `);
            console.log('✅ Coluna logo_url adicionada com sucesso!');
        } else {
            console.log('ℹ️  Coluna logo_url já existe, pulando...');
        }

        // Verificar estrutura final
        const [finalSchema] = await connection.query('DESCRIBE configuracoes');
        console.log('\n📋 Estrutura final da tabela configuracoes:');
        finalSchema.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type}${col.Null === 'NO' ? ' (NOT NULL)' : ' (nullable)'}`);
        });

        connection.release();
        console.log('\n✅ Migração concluída com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro durante a migração:', error.message);
        process.exit(1);
    }
}

adicionarColunaLogo();
