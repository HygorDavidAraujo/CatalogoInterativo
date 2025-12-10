const mysql = require('mysql2/promise');

async function adicionarCampoCPF() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '79461382',
        database: 'catalogo_vinhos'
    });

    try {
        console.log('🔧 Adicionando campo CPF na tabela usuarios...\n');

        try {
            await connection.execute(
                `ALTER TABLE usuarios ADD COLUMN cpf VARCHAR(14) NULL`
            );
            console.log('✓ Campo cpf adicionado com sucesso');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠ Campo cpf já existe');
            } else {
                throw error;
            }
        }

        console.log('\n✅ Campo CPF configurado com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await connection.end();
    }
}

adicionarCampoCPF();
