const mysql = require('mysql2/promise');

async function verificarTabela() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '79461382',
        database: 'catalogo_vinhos'
    });

    try {
        console.log('📋 Verificando estrutura da tabela usuarios...\n');

        const [columns] = await connection.execute(
            'DESCRIBE usuarios'
        );

        console.log('Colunas existentes:');
        columns.forEach(col => {
            console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await connection.end();
    }
}

verificarTabela();
