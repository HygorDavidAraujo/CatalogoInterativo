const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function configurarBanco() {
    console.log('\n🔧 Configurando banco de dados...\n');

    try {
        // Conectar sem selecionar banco específico
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        console.log('✓ Conectado ao MySQL');

        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, 'database', 'schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('✓ Arquivo SQL carregado');

        // Executar script SQL
        await connection.query(sql);

        console.log('✓ Banco de dados criado');
        console.log('✓ Tabelas criadas');
        console.log('✓ Dados iniciais inseridos');

        // Verificar criação
        await connection.query(`USE ${process.env.DB_NAME || 'catalogo_vinhos'}`);
        
        const [vinhos] = await connection.query('SELECT COUNT(*) as total FROM vinhos');
        const [configs] = await connection.query('SELECT COUNT(*) as total FROM configuracoes');
        
        console.log(`\n📊 Registros criados:`);
        console.log(`   • Vinhos: ${vinhos[0].total}`);
        console.log(`   • Configurações: ${configs[0].total}`);

        await connection.end();

        console.log('\n✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!\n');
        console.log('Execute "npm start" para iniciar o servidor.\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRO ao configurar banco de dados:\n');
        console.error(`   ${error.message}\n`);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   Verifique a senha do MySQL no arquivo .env\n');
        }
        
        process.exit(1);
    }
}

configurarBanco();
