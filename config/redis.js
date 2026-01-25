// ===== REDIS CONFIGURATION =====
const Redis = require('ioredis');
const logger = require('./logger');

// Configuração do Redis
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
        // Desistir após 3 tentativas
        if (times > 3) {
            logger.warn('Redis: Máximo de tentativas atingido. Desabilitando cache.');
            return null; // Para de tentar reconectar
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    reconnectOnError: () => false // Não reconectar automaticamente em erro
};

// Criar cliente Redis
let redisClient = null;
let isRedisAvailable = false;

/**
 * Inicializar conexão Redis
 */
async function initRedis() {
    try {
        redisClient = new Redis(redisConfig);

        redisClient.on('connect', () => {
            logger.info('✓ Redis conectado com sucesso');
            isRedisAvailable = true;
        });

        redisClient.on('error', (error) => {
            logger.error('Redis erro:', error.message);
            isRedisAvailable = false;
        });

        redisClient.on('close', () => {
            logger.warn('Redis conexão fechada');
            isRedisAvailable = false;
        });

        redisClient.on('reconnecting', () => {
            logger.info('Redis reconectando...');
        });

        // Tentar conectar
        await redisClient.connect();
        
        // Testar conexão
        await redisClient.ping();
        
        return redisClient;
    } catch (error) {
        logger.warn(`Redis não disponível: ${error.message}. Aplicação continuará sem cache.`);
        isRedisAvailable = false;
        redisClient = null;
        return null;
    }
}

/**
 * Obter cliente Redis
 */
function getRedisClient() {
    return redisClient;
}

/**
 * Verificar se Redis está disponível
 */
function isRedisConnected() {
    return isRedisAvailable && redisClient !== null;
}

/**
 * Fechar conexão Redis
 */
async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        logger.info('Redis desconectado');
    }
}

module.exports = {
    initRedis,
    getRedisClient,
    isRedisConnected,
    closeRedis
};
