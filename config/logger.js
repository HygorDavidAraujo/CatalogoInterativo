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

// Vercel functions have an ephemeral, read-only filesystem; use platform logs there.
const transports = [
    new winston.transports.Console({
        format: consoleFormat,
        level: level()
    })
];

const logsDir = !process.env.VERCEL
    ? path.join(__dirname, '..', 'logs')
    : null;

if (logsDir) {
    const fs = require('fs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
            format
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880,
            maxFiles: 5,
            format
        })
    );
}

if (process.env.NODE_ENV === 'production' && logsDir) {
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
