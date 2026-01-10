// Script para adicionar colunas VIP no Railway
require('dotenv').config();
const { pool } = require('./config/database');

async function addVipColumns() {
    try {
        console.log('🔄 Conectando ao banco de dados...');
        
        // Verificar se colunas já existem
        const [columns] = await pool.query('DESCRIBE usuarios');
        const columnNames = columns.map(c => c.Field);
        
        // Adicionar coluna is_vip
        if (!columnNames.includes('is_vip')) {
            console.log('📝 Adicionando coluna is_vip...');
            await pool.query(`
                ALTER TABLE usuarios 
                ADD COLUMN is_vip BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Coluna is_vip adicionada');
        } else {
            console.log('ℹ️  Coluna is_vip já existe');
        }
        
        // Adicionar coluna vip_tipo
        if (!columnNames.includes('vip_tipo')) {
            console.log('📝 Adicionando coluna vip_tipo...');
            await pool.query(`
                ALTER TABLE usuarios 
                ADD COLUMN vip_tipo ENUM('prata', 'ouro', 'diamante') DEFAULT NULL
            `);
            console.log('✅ Coluna vip_tipo adicionada');
        } else {
            console.log('ℹ️  Coluna vip_tipo já existe');
        }
        
        // Verificar estrutura
        console.log('\n📋 Estrutura da tabela usuarios:');
        const [finalColumns] = await pool.query('DESCRIBE usuarios');
        console.table(finalColumns);
        
        console.log('\n✨ Migração concluída com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

addVipColumns();
