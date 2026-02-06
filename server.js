const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler, transformKnownErrors } = require('./middleware/errorHandler');
const { initRedis } = require('./config/redis');
const logger = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// ===== TRUST PROXY =====
// Necessário quando atrás de um proxy reverso (Railway, Heroku, etc)
app.set('trust proxy', 1);

// ===== SEGURANÇA =====
// Helmet para headers de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"], // Permite onclick, onchange, etc
            imgSrc: ["'self'", "data:", "https:", "res.cloudinary.com", "flagcdn.com"],
            connectSrc: ["'self'", "res.cloudinary.com", "api.cloudinary.com", "cdnjs.cloudflare.com", "flagcdn.com"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// ===== PERFORMANCE =====
// Compressão de respostas
app.use(compression());

// ===== MIDDLEWARES BÁSICOS =====
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requisições HTTP
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.logRequest(req, res, duration);
    });
    
    next();
});

// Rate limiter global para todas as rotas da API
app.use('/api/', apiLimiter);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rotas
const vinhosRoutes = require('./routes/vinhos');
const configuracoesRoutes = require('./routes/configuracoes');
const authRoutes = require('./routes/auth');
const pedidosRoutes = require('./routes/pedidos');
const setupRoutes = require('./routes/setup');
const beneficiosRoutes = require('./routes/beneficios');

// Usar rotas
app.use('/api/vinhos', vinhosRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/beneficios', beneficiosRoutes);

// Setup route apenas em desenvolvimento
if (isDevelopment) {
    app.use('/api/setup', setupRoutes);
}

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const { pool } = require('./config/database');
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            database: 'connected',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        logger.error('Health check falhou:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Rota para verificar status da API
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'API do Catálogo de Vinhos está funcionando!',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// ===== ROTAS DE DEBUG (APENAS EM DESENVOLVIMENTO) =====
if (isDevelopment) {
    // Rota de diagnóstico de variáveis
    app.get('/api/check-env', (req, res) => {
        res.json({
            MYSQLHOST: process.env.MYSQLHOST || 'NÃO DEFINIDO',
            MYSQLUSER: process.env.MYSQLUSER || 'NÃO DEFINIDO',
            MYSQLPASSWORD: process.env.MYSQLPASSWORD ? '***DEFINIDO***' : 'NÃO DEFINIDO',
            MYSQLDATABASE: process.env.MYSQLDATABASE || 'NÃO DEFINIDO',
            MYSQLPORT: process.env.MYSQLPORT || 'NÃO DEFINIDO',
            NODE_ENV: process.env.NODE_ENV || 'NÃO DEFINIDO',
            REDIS_HOST: process.env.REDIS_HOST || 'NÃO DEFINIDO',
            JWT_SECRET: process.env.JWT_SECRET ? '***DEFINIDO***' : 'NÃO DEFINIDO'
        });
    });
    
    logger.info('Rotas de debug habilitadas (apenas desenvolvimento)');
}

// ===== ERROR HANDLING =====
// Transformar erros conhecidos
app.use(transformKnownErrors);

// Rota não encontrada
app.use(notFoundHandler);

// Handler global de erros (deve ser o último middleware)
app.use(errorHandler);

// Iniciar servidor
async function startServer() {
    try {
        // Banner de inicialização
        logger.info(`${'='.repeat(60)}`);
        logger.info('🍷  Catálogo de Vinhos - Inicializando...');
        logger.info(`${'='.repeat(60)}`);
        
        // Validar JWT_SECRET em produção
        if (!isDevelopment && !process.env.JWT_SECRET) {
            logger.error('❌ JWT_SECRET não definido! Defina esta variável em produção.');
            process.exit(1);
        }
        
        // Testar conexão com banco de dados
        logger.info('Conectando ao banco de dados...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            logger.warn('⚠️  Banco de dados não conectado. Verifique as configurações.');
        } else {
            logger.info('✓ Banco de dados conectado');
        }
        
        // Inicializar Redis (opcional - não bloqueia se falhar)
        logger.info('Inicializando Redis...');
        try {
            await initRedis();
            logger.info('✓ Redis inicializado com sucesso');
        } catch (error) {
            logger.warn(`⚠️  Redis não disponível: ${error.message}`);
            logger.info('Aplicação continuará sem cache');
        }
        
        // Iniciar servidor HTTP
        app.listen(PORT, () => {
            logger.info(`${'='.repeat(60)}`);
            logger.info(`✓ Servidor rodando na porta ${PORT}`);
            logger.info(`🌐 URL: http://localhost:${PORT}`);
            logger.info(`📊 Admin: http://localhost:${PORT}/admin`);
            logger.info(`🔌 API Status: http://localhost:${PORT}/api/status`);
            logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
            logger.info(`⚙️  Ambiente: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`${'='.repeat(60)}`);
        });
    } catch (error) {
        logger.error('❌ Erro crítico ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM recebido. Encerrando gracefully...');
    const { closeRedis } = require('./config/redis');
    await closeRedis();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT recebido. Encerrando gracefully...');
    const { closeRedis } = require('./config/redis');
    await closeRedis();
    process.exit(0);
});

startServer();

module.exports = app;
