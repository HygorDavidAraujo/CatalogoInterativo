const mysql = require('mysql2/promise');

// Use Railway credentials
const host = 'shinkansen.proxy.rlwy.net';
const user = 'root';
const password = 'MmAfPhyjxuZDBtuwVZilwfXoIPPQJOyT';
const database = 'railway';
const port = 17740;

async function criarTabelaBeneficios() {
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

        // Verificar se a tabela já existe
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = '${database}' 
            AND TABLE_NAME = 'beneficios_vip'
        `);

        if (tables.length > 0) {
            console.log('ℹ️  Tabela beneficios_vip já existe, pulando criação...');
        } else {
            console.log('📝 Criando tabela beneficios_vip...');
            await connection.query(`
                CREATE TABLE beneficios_vip (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nome VARCHAR(50) NOT NULL UNIQUE,
                    slug VARCHAR(50) NOT NULL UNIQUE,
                    tipo_desconto ENUM('percentual', 'valor_fixo') NOT NULL DEFAULT 'percentual',
                    valor_desconto DECIMAL(10,2) NOT NULL,
                    ativo BOOLEAN NOT NULL DEFAULT TRUE,
                    ordem INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabela beneficios_vip criada com sucesso!');

            // Inserir benefícios padrão
            console.log('📝 Inserindo benefícios VIP padrão...');
            await connection.query(`
                INSERT INTO beneficios_vip (nome, slug, tipo_desconto, valor_desconto, ordem) VALUES
                ('VIP Prata', 'prata', 'percentual', 3.00, 1),
                ('VIP Ouro', 'ouro', 'percentual', 7.00, 2),
                ('VIP Diamante', 'diamante', 'percentual', 11.00, 3)
            `);
            console.log('✅ Benefícios VIP padrão inseridos!');
        }

        // Verificar estrutura final
        const [schema] = await connection.query('DESCRIBE beneficios_vip');
        console.log('\n📋 Estrutura da tabela beneficios_vip:');
        schema.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type}${col.Null === 'NO' ? ' (NOT NULL)' : ''}`);
        });

        // Verificar dados inseridos
        const [rows] = await connection.query('SELECT * FROM beneficios_vip ORDER BY ordem');
        console.log('\n📊 Benefícios VIP cadastrados:');
        rows.forEach(row => {
            console.log(`  - ${row.nome}: ${row.valor_desconto}${row.tipo_desconto === 'percentual' ? '%' : ' R$'}`);
        });

        connection.release();
        console.log('\n✅ Migração concluída com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro durante a migração:', error.message);
        process.exit(1);
    }
}

criarTabelaBeneficios();
