const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    console.log('📋 Variáveis de ambiente detectadas:');
    console.log('   DB_HOST:', process.env.DB_HOST || 'NÃO DEFINIDO');
    console.log('   DB_USER:', process.env.DB_USER || 'NÃO DEFINIDO');
    console.log('   DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NÃO DEFINIDO');
    console.log('   DB_NAME:', process.env.DB_NAME || 'NÃO DEFINIDO');
    console.log('   DB_PORT:', process.env.DB_PORT || 'NÃO DEFINIDO');
    console.log('');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '79461382',
        database: process.env.DB_NAME || 'catalogo_vinhos',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('✅ Conexão com banco estabelecida!');
        console.log('🔧 Criando estrutura do banco de dados...\n');

        // Criar tabela de vinhos
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS vinhos (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome VARCHAR(200) NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                uva VARCHAR(100),
                ano INT,
                preco DECIMAL(10,2) NOT NULL,
                descricao TEXT,
                harmonizacao TEXT,
                guarda VARCHAR(100),
                imagem VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabela vinhos criada');

        // Criar tabela de configurações
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome_site VARCHAR(200),
                titulo VARCHAR(200),
                descricao TEXT,
                telefone VARCHAR(20),
                email VARCHAR(100),
                endereco TEXT,
                whatsapp VARCHAR(20),
                instagram VARCHAR(200),
                facebook VARCHAR(200),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabela configuracoes criada');

        // Inserir configurações padrão
        const [configRows] = await connection.execute('SELECT COUNT(*) as count FROM configuracoes');
        if (configRows[0].count === 0) {
            await connection.execute(`
                INSERT INTO configuracoes (nome_site, titulo, descricao, telefone, email, whatsapp)
                VALUES ('Davini Vinhos Finos', 'Descubra Vinhos Excepcionais', 'Uma seleção especial dos melhores vinhos para você', '(62) 98183-1483', 'contato@davinivinhos.com', '5562981831483')
            `);
            console.log('✓ Configurações padrão inseridas');
        }

        // Criar tabela de usuários
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nome_completo VARCHAR(200) NOT NULL,
                telefone VARCHAR(20),
                email VARCHAR(100) UNIQUE NOT NULL,
                senha VARCHAR(100) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                cpf VARCHAR(14),
                logradouro VARCHAR(200),
                numero VARCHAR(10),
                complemento VARCHAR(100),
                bairro VARCHAR(100),
                cep VARCHAR(10),
                cidade VARCHAR(100),
                estado VARCHAR(2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabela usuarios criada');

        // Criar usuário admin padrão
        const [userRows] = await connection.execute('SELECT COUNT(*) as count FROM usuarios WHERE email = ?', ['hygordavidaraujo@gmail.com']);
        if (userRows[0].count === 0) {
            await connection.execute(`
                INSERT INTO usuarios (nome_completo, email, senha, is_admin)
                VALUES ('Admin', 'hygordavidaraujo@gmail.com', '79461382', TRUE)
            `);
            console.log('✓ Usuário admin criado (hygordavidaraujo@gmail.com / 79461382)');
        } else {
            console.log('⚠️  Usuário admin já existe');
        }
        
        // Verificar e mostrar todos os usuários
        const [allUsers] = await connection.execute('SELECT id, nome_completo, email, is_admin FROM usuarios');
        console.log('\n👥 Usuários no banco:');
        allUsers.forEach(user => {
            console.log(`   ${user.is_admin ? '👑' : '👤'} ${user.nome_completo} (${user.email}) - Admin: ${user.is_admin}`);
        });

        // Criar tabela de pedidos
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id INT PRIMARY KEY AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pendente',
                observacoes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabela pedidos criada');

        // Criar tabela de itens do pedido
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS pedidos_itens (
                id INT PRIMARY KEY AUTO_INCREMENT,
                pedido_id INT NOT NULL,
                vinho_id INT NOT NULL,
                vinho_nome VARCHAR(200) NOT NULL,
                quantidade INT NOT NULL,
                preco_unitario DECIMAL(10,2) NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
                FOREIGN KEY (vinho_id) REFERENCES vinhos(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabela pedidos_itens criada');

        console.log('\n✅ Banco de dados configurado com sucesso!');
        console.log('\n📊 Credenciais do admin:');
        console.log('   Email: hygordavidaraujo@gmail.com');
        console.log('   Senha: 79461382\n');

    } catch (error) {
        console.error('❌ Erro ao configurar banco:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

setupDatabase();
