const mysql = require('mysql2/promise');

async function adicionarCamposEndereco() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '79461382',
        database: 'catalogo_vinhos'
    });

    try {
        console.log('🔧 Adicionando campos de endereço na tabela usuarios...\n');

        // Adicionar campos de endereço
        const campos = [
            { nome: 'logradouro', tipo: 'VARCHAR(200)' },
            { nome: 'numero', tipo: 'VARCHAR(10)' },
            { nome: 'complemento', tipo: 'VARCHAR(100)' },
            { nome: 'bairro', tipo: 'VARCHAR(100)' },
            { nome: 'cep', tipo: 'VARCHAR(10)' },
            { nome: 'cidade', tipo: 'VARCHAR(100)' },
            { nome: 'estado', tipo: 'VARCHAR(2)' }
        ];

        for (const campo of campos) {
            try {
                await connection.execute(
                    `ALTER TABLE usuarios ADD COLUMN ${campo.nome} ${campo.tipo} NULL`
                );
                console.log(`✓ Campo ${campo.nome} adicionado com sucesso`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`⚠ Campo ${campo.nome} já existe`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n✅ Campos de endereço configurados com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await connection.end();
    }
}

adicionarCamposEndereco();
