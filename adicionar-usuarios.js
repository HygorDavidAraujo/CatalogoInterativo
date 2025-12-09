const mysql = require('mysql2/promise');
require('dotenv').config();

async function adicionarTabelaUsuarios() {
    console.log('\n🔧 Adicionando tabela de usuários...\n');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'catalogo_vinhos',
            port: process.env.DB_PORT || 3306
        });

        console.log('✓ Conectado ao MySQL');

        // Criar tabela de usuários
        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome_completo VARCHAR(255) NOT NULL,
                telefone VARCHAR(20) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✓ Tabela usuarios criada');

        // Verificar se admin já existe
        const [admins] = await connection.query(
            'SELECT id FROM usuarios WHERE email = ?',
            ['hygordavidaraujo@gmail.com']
        );

        if (admins.length === 0) {
            // Inserir usuário administrador
            await connection.query(`
                INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) 
                VALUES ('Hygor David Araujo', '(62)98183-1483', 'hygordavidaraujo@gmail.com', '79461382', TRUE)
            `);
            console.log('✓ Usuário administrador criado');
        } else {
            console.log('✓ Usuário administrador já existe');
        }

        // Contar usuários
        const [usuarios] = await connection.query('SELECT COUNT(*) as total FROM usuarios');
        console.log(`\n📊 Total de usuários: ${usuarios[0].total}`);

        await connection.end();

        console.log('\n✅ TABELA DE USUÁRIOS CONFIGURADA COM SUCESSO!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRO:', error.message, '\n');
        process.exit(1);
    }
}

adicionarTabelaUsuarios();
