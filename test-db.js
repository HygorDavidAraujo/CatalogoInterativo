const mysql = require('mysql2/promise');
require('dotenv').config();

async function testarConexao() {
    console.log('\n🔍 Testando conexão com o banco de dados...\n');
    console.log('Configurações:');
    console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  Porta: ${process.env.DB_PORT || 3306}`);
    console.log(`  Usuário: ${process.env.DB_USER || 'root'}`);
    console.log(`  Banco: ${process.env.DB_NAME || 'catalogo_vinhos'}\n`);

    try {
        // Testar conexão sem selecionar banco
        const connectionWithoutDB = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306
        });

        console.log('✓ Conexão com MySQL estabelecida com sucesso!\n');

        // Verificar se o banco existe
        const [databases] = await connectionWithoutDB.query(
            "SHOW DATABASES LIKE ?", 
            [process.env.DB_NAME || 'catalogo_vinhos']
        );

        if (databases.length === 0) {
            console.log('⚠️  ATENÇÃO: O banco de dados não existe!');
            console.log('\nPara criar o banco, execute:');
            console.log('  mysql -u root -p < database/schema.sql\n');
            console.log('Ou crie manualmente executando o arquivo database/schema.sql\n');
            await connectionWithoutDB.end();
            process.exit(1);
        }

        console.log('✓ Banco de dados encontrado!\n');
        await connectionWithoutDB.end();

        // Conectar ao banco específico
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'catalogo_vinhos',
            port: process.env.DB_PORT || 3306
        });

        // Verificar tabelas
        const [tables] = await connection.query('SHOW TABLES');
        console.log('Tabelas encontradas:');
        tables.forEach(table => {
            console.log(`  ✓ ${Object.values(table)[0]}`);
        });

        // Contar registros
        const [vinhos] = await connection.query('SELECT COUNT(*) as total FROM vinhos');
        const [configs] = await connection.query('SELECT COUNT(*) as total FROM configuracoes');
        
        console.log(`\nRegistros:`);
        console.log(`  Vinhos: ${vinhos[0].total}`);
        console.log(`  Configurações: ${configs[0].total}`);

        await connection.end();

        console.log('\n✅ TUDO PRONTO! O banco de dados está configurado corretamente.\n');
        console.log('Execute "npm start" para iniciar o servidor.\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRO ao conectar com o banco de dados:\n');
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('  Usuário ou senha incorretos.');
            console.error('  Verifique as configurações no arquivo .env\n');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('  MySQL não está rodando ou não está acessível.');
            console.error('  Certifique-se de que o MySQL está iniciado.\n');
        } else {
            console.error(`  ${error.message}\n`);
        }

        process.exit(1);
    }
}

testarConexao();
