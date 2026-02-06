// Script para alterar coluna vip_tipo de ENUM para VARCHAR dinâmico
const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'shinkansen.proxy.rlwy.net',
    port: 17740,
    user: 'root',
    password: 'MmAfPhyjxuZDBtuwVZilwfXoIPPQJOyT',
    database: 'railway'
};

async function corrigirVipTipo() {
    let connection;
    
    try {
        console.log('🔌 Conectando ao banco de dados...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado ao banco de dados da Railway\n');

        // Verificar estrutura atual
        console.log('📋 Verificando estrutura da coluna vip_tipo...');
        const [columns] = await connection.query(`
            SELECT COLUMN_TYPE, COLUMN_KEY, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'railway' 
            AND TABLE_NAME = 'usuarios' 
            AND COLUMN_NAME = 'vip_tipo'
        `);

        if (columns.length === 0) {
            console.log('❌ Coluna vip_tipo não encontrada na tabela usuarios');
            await connection.end();
            return;
        }

        console.log(`Tipo atual: ${columns[0].COLUMN_TYPE}`);
        console.log(`Anulável: ${columns[0].IS_NULLABLE}\n`);

        // Se já é VARCHAR, não precisa fazer nada
        if (columns[0].COLUMN_TYPE.includes('varchar')) {
            console.log('✅ Coluna já é VARCHAR - nenhuma alteração necessária');
            
            // Listar VIPs válidos
            console.log('\n📊 VIPs cadastrados no sistema:');
            const [beneficios] = await connection.query('SELECT slug, nome FROM beneficios_vip ORDER BY ordem');
            beneficios.forEach(b => {
                console.log(`  - ${b.slug}: ${b.nome}`);
            });
            
            await connection.end();
            return;
        }

        // Converter ENUM para VARCHAR
        console.log('📝 Convertendo vip_tipo de ENUM para VARCHAR...');
        await connection.query(`
            ALTER TABLE usuarios 
            MODIFY COLUMN vip_tipo VARCHAR(50)
        `);
        console.log('✅ Coluna vip_tipo alterada para VARCHAR(50)\n');

        // Verificar estrutura atualizada
        console.log('📋 Estrutura atualizada:');
        const [structure] = await connection.query('DESCRIBE usuarios');
        const vipTipo = structure.find(col => col.Field === 'vip_tipo');
        if (vipTipo) {
            const nullable = vipTipo.Null === 'YES' ? '' : '(NOT NULL)';
            console.log(`  - vip_tipo: ${vipTipo.Type} ${nullable}`);
        }

        // Listar VIPs válidos
        console.log('\n📊 VIPs cadastrados no sistema (agora aceitos):');
        const [beneficios] = await connection.query('SELECT slug, nome FROM beneficios_vip WHERE ativo = 1 ORDER BY ordem');
        beneficios.forEach(b => {
            console.log(`  ✓ ${b.slug}: ${b.nome}`);
        });

        // Verificar usuários com VIP inválido
        console.log('\n📊 Usuários VIP cadastrados:');
        const [usuarios] = await connection.query(
            'SELECT id, nome_completo, vip_tipo FROM usuarios WHERE is_vip = 1 ORDER BY id'
        );
        if (usuarios.length === 0) {
            console.log('  (Nenhum usuário VIP)');
        } else {
            usuarios.forEach(u => {
                console.log(`  - ID ${u.id}: ${u.nome_completo} (${u.vip_tipo || 'sem tipo'})`);
            });
        }

        console.log('\n✅ Migração concluída com sucesso!');
        console.log('📝 Agora você pode usar qualquer slug de benefício para vip_tipo');

    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

corrigirVipTipo();
