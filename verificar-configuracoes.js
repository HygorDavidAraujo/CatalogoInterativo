require('dotenv').config();
const { pool } = require('./config/database');

async function verificarConfiguracoes() {
    try {
        console.log('===== VERIFICANDO CONFIGURAÇÕES =====\n');
        
        const [configs] = await pool.query('SELECT * FROM configuracoes ORDER BY chave');
        
        if (configs.length === 0) {
            console.log('❌ Nenhuma configuração encontrada no banco de dados.');
        } else {
            console.log('✅ Configurações encontradas:\n');
            configs.forEach(config => {
                console.log(`  ${config.chave}: ${config.valor}`);
            });
        }
        
        console.log('\n===================================');
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao verificar configurações:', error.message);
        process.exit(1);
    }
}

verificarConfiguracoes();
