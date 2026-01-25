// ===== WINSTON LOGGER CONFIGURATION =====
const winston = require('winston');
const path = require('path');

// Definir níveis de log personalizados
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Definir cores para cada nível
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

winston.addColors(colors);

// Determinar nível de log baseado no ambiente
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'info';
};

// Formato personalizado para logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Formato para console (mais legível em desenvolvimento)
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(
        (info) => `${info.timestamp} [${info.level}]: ${info.message} ${info.stack || ''}`
    )
);

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '..', 'logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Configurar transports (destinos dos logs)
const transports = [
    // Console - sempre ativo
    new winston.transports.Console({
        format: consoleFormat,
        level: level()
    }),
    
    // Arquivo de erro - apenas erros
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: format
    }),
    
    // Arquivo combinado - todos os níveis
    new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: format
    })
];

// Adicionar transport separado para HTTP em produção
if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'http.log'),
            level: 'http',
            maxsize: 5242880, // 5MB
            maxFiles: 3,
            format: format
        })
    );
}

// Criar instância do logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
    exitOnError: false
});

// Middleware para logging de requisições HTTP
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

// Função helper para logging de requisições
logger.logRequest = (req, res, responseTime) => {
    logger.http(`${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
};

// Função helper para logging de queries do banco
logger.logQuery = (query, duration) => {
    logger.debug('Database query', {
        query: query.substring(0, 200), // Limitar tamanho
        duration: `${duration}ms`
    });
};

module.exports = logger;
