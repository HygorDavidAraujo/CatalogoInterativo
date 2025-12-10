const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rotas
const vinhosRoutes = require('./routes/vinhos');
const configuracoesRoutes = require('./routes/configuracoes');
const authRoutes = require('./routes/auth');
const pedidosRoutes = require('./routes/pedidos');
const setupRoutes = require('./routes/setup');

// Usar rotas
app.use('/api/vinhos', vinhosRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/setup', setupRoutes);

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Rota de diagnóstico de variáveis
app.get('/api/check-env', (req, res) => {
    res.json({
        MYSQLHOST: process.env.MYSQLHOST || 'NÃO DEFINIDO',
        MYSQLUSER: process.env.MYSQLUSER || 'NÃO DEFINIDO',
        MYSQLPASSWORD: process.env.MYSQLPASSWORD ? '***DEFINIDO***' : 'NÃO DEFINIDO',
        MYSQLDATABASE: process.env.MYSQLDATABASE || 'NÃO DEFINIDO',
        MYSQLPORT: process.env.MYSQLPORT || 'NÃO DEFINIDO',
        DB_HOST: process.env.DB_HOST || 'NÃO DEFINIDO',
        DB_USER: process.env.DB_USER || 'NÃO DEFINIDO',
        DB_PASSWORD: process.env.DB_PASSWORD ? '***DEFINIDO***' : 'NÃO DEFINIDO',
        DB_NAME: process.env.DB_NAME || 'NÃO DEFINIDO',
        DB_PORT: process.env.DB_PORT || 'NÃO DEFINIDO',
        NODE_ENV: process.env.NODE_ENV || 'NÃO DEFINIDO'
    });
});

// Rota para adicionar coluna 'ativo' na tabela vinhos
app.get('/api/add-ativo-column', async (req, res) => {
    const mysql = require('mysql2/promise');
    
    try {
        const dbConfig = {
            host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
            user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '79461382',
            database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'catalogo_vinhos',
            port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306')
        };

        const connection = await mysql.createConnection(dbConfig);
        
        // Verificar se a coluna já existe
        const [columns] = await connection.execute(
            "SHOW COLUMNS FROM vinhos LIKE 'ativo'"
        );
        
        if (columns.length === 0) {
            // Adicionar coluna 'ativo' (TRUE = mostrar no site, FALSE = ocultar)
            await connection.execute(
                'ALTER TABLE vinhos ADD COLUMN ativo BOOLEAN DEFAULT TRUE AFTER imagem'
            );
            
            await connection.end();
            res.send('<h1>✅ Coluna "ativo" adicionada com sucesso!</h1><p>Todos os vinhos existentes estão marcados como ativos (visíveis).</p><p><a href="/admin">Ir para o painel admin</a></p>');
        } else {
            await connection.end();
            res.send('<h1>ℹ️ Coluna "ativo" já existe!</h1><p><a href="/admin">Ir para o painel admin</a></p>');
        }
    } catch (error) {
        res.status(500).send(`<h1>❌ Erro</h1><pre>${error.message}</pre>`);
    }
});

// Rota para corrigir vinhos com ativo NULL
app.get('/api/fix-ativo', async (req, res) => {
    const mysql = require('mysql2/promise');
    
    try {
        const dbConfig = {
            host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
            user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '79461382',
            database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'catalogo_vinhos',
            port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306')
        };

        const connection = await mysql.createConnection(dbConfig);
        
        // Atualizar todos os vinhos com ativo NULL para TRUE
        const [result] = await connection.execute(
            'UPDATE vinhos SET ativo = TRUE WHERE ativo IS NULL'
        );
        
        await connection.end();
        
        res.send(`
            <h1>✅ Vinhos corrigidos!</h1>
            <p>${result.affectedRows} vinho(s) foram marcados como ativos.</p>
            <p><a href="/admin">Ir para o painel admin</a></p>
        `);
    } catch (error) {
        res.status(500).send(`<h1>❌ Erro</h1><pre>${error.message}</pre>`);
    }
});

// Rota de setup do banco de dados
app.get('/api/setup', async (req, res) => {
    const mysql = require('mysql2/promise');
    
    try {
        // Mostrar variáveis de ambiente
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

        // Criar tabelas
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

// Rota para verificar status da API
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'API do Catálogo de Vinhos está funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
async function startServer() {
    try {
        // Testar conexão com banco de dados
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.log('\n⚠️  ATENÇÃO: Não foi possível conectar ao banco de dados!');
            console.log('Por favor, verifique se o MySQL está rodando e as configurações do .env estão corretas.\n');
        }

        app.listen(PORT, () => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🍷  Servidor do Catálogo de Vinhos iniciado!`);
            console.log(`${'='.repeat(60)}`);
            console.log(`🌐  URL: http://localhost:${PORT}`);
            console.log(`📊  Admin: http://localhost:${PORT}/admin.html`);
            console.log(`🔌  API: http://localhost:${PORT}/api/status`);
            console.log(`${'='.repeat(60)}\n`);
        });
    } catch (error) {
        console.error('Erro ao iniciar o servidor:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
