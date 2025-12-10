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
