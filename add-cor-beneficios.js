// Script para adicionar coluna 'cor' na tabela beneficios_vip
const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'shinkansen.proxy.rlwy.net',
    port: 17740,
    user: 'root',
    password: 'MmAfPhyjxuZDBtuwVZilwfXoIPPQJOyT',
    database: 'railway'
};

async function adicionarColunaCor() {
    let connection;
    
    try {
        console.log('🔌 Conectando ao banco de dados...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado ao banco de dados da Railway\n');

        // Verificar se a coluna 'cor' já existe
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'railway' 
            AND TABLE_NAME = 'beneficios_vip' 
            AND COLUMN_NAME = 'cor'
        `);

        if (columns.length > 0) {
            console.log('⚠️  A coluna "cor" já existe na tabela beneficios_vip');
            await connection.end();
            return;
        }

        // Adicionar coluna cor
        console.log('📝 Adicionando coluna "cor" na tabela beneficios_vip...');
        await connection.query(`
            ALTER TABLE beneficios_vip 
            ADD COLUMN cor VARCHAR(7) DEFAULT '#6B1C40' AFTER valor_desconto
        `);
        console.log('✅ Coluna "cor" adicionada com sucesso!\n');

        // Atualizar cores padrão para os VIPs existentes
        console.log('🎨 Configurando cores padrão...');
        await connection.query(`
            UPDATE beneficios_vip 
            SET cor = '#C0C0C0' 
            WHERE slug = 'prata'
        `);
        console.log('  ✓ VIP Prata: #C0C0C0 (Prata)');

        await connection.query(`
            UPDATE beneficios_vip 
            SET cor = '#FFD700' 
            WHERE slug = 'ouro'
        `);
        console.log('  ✓ VIP Ouro: #FFD700 (Dourado)');

        await connection.query(`
            UPDATE beneficios_vip 
            SET cor = '#B9F2FF' 
            WHERE slug = 'diamante'
        `);
        console.log('  ✓ VIP Diamante: #B9F2FF (Diamante)\n');

        // Verificar estrutura atualizada
        console.log('📋 Estrutura da tabela beneficios_vip atualizada:');
        const [structure] = await connection.query('DESCRIBE beneficios_vip');
        structure.forEach(col => {
            const nullable = col.Null === 'YES' ? '' : '(NOT NULL)';
            console.log(`  - ${col.Field}: ${col.Type} ${nullable}`);
        });

        // Listar benefícios com cores
        console.log('\n📊 Benefícios VIP com cores:');
        const [beneficios] = await connection.query('SELECT nome, slug, cor FROM beneficios_vip ORDER BY ordem');
        beneficios.forEach(b => {
            console.log(`  - ${b.nome} (${b.slug}): ${b.cor}`);
        });

        console.log('\n✅ Migração concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

adicionarColunaCor();
