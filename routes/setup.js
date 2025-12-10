const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

console.log('✅ Rota /api/setup carregada com sucesso!');

router.get('/setup', async (req, res) => {
    console.log('🔧 Executando setup do banco de dados...');
    try {
        // Mostrar variáveis de ambiente (sem mostrar senhas completas)
        const envInfo = {
            MYSQLHOST: process.env.MYSQLHOST || 'NÃO DEFINIDO',
            MYSQLUSER: process.env.MYSQLUSER || 'NÃO DEFINIDO',
            MYSQLPASSWORD: process.env.MYSQLPASSWORD ? '***DEFINIDO***' : 'NÃO DEFINIDO',
            MYSQLDATABASE: process.env.MYSQLDATABASE || 'NÃO DEFINIDO',
            MYSQLPORT: process.env.MYSQLPORT || 'NÃO DEFINIDO',
            DB_HOST: process.env.DB_HOST || 'NÃO DEFINIDO',
            DB_USER: process.env.DB_USER || 'NÃO DEFINIDO',
            DB_PASSWORD: process.env.DB_PASSWORD ? '***DEFINIDO***' : 'NÃO DEFINIDO',
            DB_NAME: process.env.DB_NAME || 'NÃO DEFINIDO',
            DB_PORT: process.env.DB_PORT || 'NÃO DEFINIDO'
        };

        let output = '<h1>🔧 Setup do Banco de Dados</h1>';
        output += '<h2>📋 Variáveis de Ambiente:</h2>';
        output += '<pre>' + JSON.stringify(envInfo, null, 2) + '</pre>';
        output += '<hr>';

        // Configuração do banco
        const dbConfig = {
            host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
            user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '79461382',
            database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'catalogo_vinhos',
            port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306')
        };

        output += '<h2>🔌 Configuração de Conexão:</h2>';
        output += '<pre>' + JSON.stringify({
            host: dbConfig.host,
            user: dbConfig.user,
            database: dbConfig.database,
            port: dbConfig.port,
            password: '***'
        }, null, 2) + '</pre>';
        output += '<hr>';

        const connection = await mysql.createConnection(dbConfig);
        output += '<p>✅ Conexão estabelecida com sucesso!</p>';

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
        output += '<p>✓ Tabela vinhos criada</p>';

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
        output += '<p>✓ Tabela configuracoes criada</p>';

        // Inserir configurações padrão
        const [configRows] = await connection.execute('SELECT COUNT(*) as count FROM configuracoes');
        if (configRows[0].count === 0) {
            await connection.execute(`
                INSERT INTO configuracoes (nome_site, titulo, descricao, telefone, email, whatsapp)
                VALUES ('Davini Vinhos Finos', 'Descubra Vinhos Excepcionais', 'Uma seleção especial dos melhores vinhos para você', '(62) 98183-1483', 'contato@davinivinhos.com', '5562981831483')
            `);
            output += '<p>✓ Configurações padrão inseridas</p>';
        } else {
            output += '<p>⚠️  Configurações já existem</p>';
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
        output += '<p>✓ Tabela usuarios criada</p>';

        // Criar usuário admin
        const [userRows] = await connection.execute('SELECT COUNT(*) as count FROM usuarios WHERE email = ?', ['hygordavidaraujo@gmail.com']);
        if (userRows[0].count === 0) {
            await connection.execute(`
                INSERT INTO usuarios (nome_completo, email, senha, is_admin)
                VALUES ('Admin', 'hygordavidaraujo@gmail.com', '79461382', TRUE)
            `);
            output += '<p>✓ Usuário admin criado</p>';
        } else {
            output += '<p>⚠️  Usuário admin já existe</p>';
        }

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
        output += '<p>✓ Tabela pedidos criada</p>';

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
        output += '<p>✓ Tabela pedidos_itens criada</p>';

        // Listar usuários
        const [allUsers] = await connection.execute('SELECT id, nome_completo, email, is_admin FROM usuarios');
        output += '<h2>👥 Usuários no banco:</h2>';
        output += '<ul>';
        allUsers.forEach(user => {
            output += `<li>${user.is_admin ? '👑' : '👤'} ${user.nome_completo} (${user.email}) - Admin: ${user.is_admin}</li>`;
        });
        output += '</ul>';

        output += '<hr>';
        output += '<h2>🎉 Setup Concluído!</h2>';
        output += '<p><strong>Credenciais de Admin:</strong></p>';
        output += '<ul>';
        output += '<li>Email: <code>hygordavidaraujo@gmail.com</code></li>';
        output += '<li>Senha: <code>79461382</code></li>';
        output += '</ul>';
        output += '<p><a href="/">Ir para o site</a></p>';

        await connection.end();

        res.send(output);
    } catch (error) {
        res.status(500).send(`
            <h1>❌ Erro ao configurar banco</h1>
            <pre>${error.message}</pre>
            <pre>${error.stack}</pre>
        `);
    }
});

module.exports = router;
