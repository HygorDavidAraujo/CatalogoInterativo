// ===== CACHE SERVICE =====
const { getRedisClient, isRedisConnected } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Serviço de cache com fallback quando Redis não está disponível
 */
class CacheService {
    constructor() {
        this.defaultTTL = 300; // 5 minutos padrão
    }

    /**
     * Obter valor do cache
     */
    async get(key) {
        if (!isRedisConnected()) {
            return null;
        }

        try {
            const client = getRedisClient();
            const data = await client.get(key);
            
            if (data) {
                logger.debug(`Cache HIT: ${key}`);
                return JSON.parse(data);
            }
            
            logger.debug(`Cache MISS: ${key}`);
            return null;
        } catch (error) {
            logger.error(`Erro ao buscar cache (${key}):`, error.message);
            return null;
        }
    }

    /**
     * Definir valor no cache
     */
    async set(key, value, ttl = this.defaultTTL) {
        if (!isRedisConnected()) {
            return false;
        }

        try {
            const client = getRedisClient();
            const serialized = JSON.stringify(value);
            await client.setex(key, ttl, serialized);
            logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
            return true;
        } catch (error) {
            logger.error(`Erro ao definir cache (${key}):`, error.message);
            return false;
        }
    }

    /**
     * Deletar chave do cache
     */
    async delete(key) {
        if (!isRedisConnected()) {
            return false;
        }

        try {
            const client = getRedisClient();
            await client.del(key);
            logger.debug(`Cache DELETE: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao deletar cache (${key}):`, error.message);
            return false;
        }
    }

    /**
     * Deletar múltiplas chaves por padrão
     */
    async deletePattern(pattern) {
        if (!isRedisConnected()) {
            return false;
        }

        try {
            const client = getRedisClient();
            const keys = await client.keys(pattern);
            
            if (keys.length > 0) {
                await client.del(...keys);
                logger.debug(`Cache DELETE pattern: ${pattern} (${keys.length} chaves)`);
            }
            
            return true;
        } catch (error) {
            logger.error(`Erro ao deletar padrão (${pattern}):`, error.message);
            return false;
        }
    }

    /**
     * Limpar todo o cache
     */
    async flush() {
        if (!isRedisConnected()) {
            return false;
        }

        try {
            const client = getRedisClient();
            await client.flushdb();
            logger.info('Cache limpo completamente');
            return true;
        } catch (error) {
            logger.error('Erro ao limpar cache:', error.message);
            return false;
        }
    }

    /**
     * Middleware Express para cache automático
     */
    cacheMiddleware(ttl = this.defaultTTL, keyGenerator = null) {
        return async (req, res, next) => {
            // Apenas cachear requisições GET
            if (req.method !== 'GET') {
                return next();
            }

            // Gerar chave do cache
            const cacheKey = keyGenerator 
                ? keyGenerator(req) 
                : `cache:${req.originalUrl}`;

            try {
                // Tentar obter do cache
                const cachedData = await this.get(cacheKey);
                
                if (cachedData) {
                    return res.json(cachedData);
                }

                // Interceptar res.json para cachear resposta
                const originalJson = res.json.bind(res);
                res.json = (data) => {
                    // Cachear apenas respostas bem-sucedidas
                    if (res.statusCode === 200) {
                        this.set(cacheKey, data, ttl).catch(err => {
                            logger.error('Erro ao cachear resposta:', err.message);
                        });
                    }
                    return originalJson(data);
                };

                next();
            } catch (error) {
                logger.error('Erro no middleware de cache:', error.message);
                next();
            }
        };
    }

    /**
     * Invalidar cache relacionado a vinhos
     */
    async invalidateVinhosCache() {
        await this.deletePattern('cache:/api/vinhos*');
        logger.info('Cache de vinhos invalidado');
    }

    /**
     * Invalidar cache relacionado a configurações
     */
    async invalidateConfigCache() {
        await this.deletePattern('cache:/api/configuracoes*');
        logger.info('Cache de configurações invalidado');
    }
}

// Exportar instância singleton
module.exports = new CacheService();
