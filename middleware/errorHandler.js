// ===== ERROR HANDLING MIDDLEWARE =====

/**
 * Classe customizada para erros operacionais da aplicação
 */
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Middleware global de tratamento de erros
 * Deve ser o último middleware registrado no Express
 */
const errorHandler = (err, req, res, next) => {
    const logger = require('../config/logger');
    
    // Define valores padrão
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Erro interno do servidor';

    // Log do erro
    if (err.statusCode >= 500) {
        logger.error('Erro no servidor:', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userId: req.usuario?.id
        });
    } else {
        logger.warn('Erro do cliente:', {
            message: err.message,
            url: req.originalUrl,
            method: req.method,
            statusCode: err.statusCode
        });
    }

    // Resposta em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
        return res.status(err.statusCode).json({
            status: 'error',
            statusCode: err.statusCode,
            message: err.message,
            stack: err.stack,
            timestamp: err.timestamp
        });
    }

    // Resposta em produção
    // Apenas erros operacionais esperados devem expor detalhes
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
            timestamp: err.timestamp
        });
    }

    // Erros de programação ou desconhecidos - não expor detalhes
    return res.status(500).json({
        status: 'error',
        message: 'Algo deu errado. Tente novamente mais tarde.',
        timestamp: new Date().toISOString()
    });
};

/**
 * Middleware para capturar rotas não encontradas
 */
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Rota não encontrada: ${req.originalUrl}`, 404);
    next(error);
};

/**
 * Handler para erros assíncronos
 * Wrapper para evitar try-catch em todas as rotas async
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Validar erros comuns do MySQL
 */
const handleMySQLError = (err) => {
    if (err.code === 'ER_DUP_ENTRY') {
        return new AppError('Este registro já existe no sistema', 409);
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return new AppError('Referência inválida no banco de dados', 400);
    }
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return new AppError('Não é possível excluir este registro pois está sendo usado', 400);
    }
    return err;
};

/**
 * Validar erros do JWT
 */
const handleJWTError = () => {
    return new AppError('Token inválido. Faça login novamente.', 401);
};

const handleJWTExpiredError = () => {
    return new AppError('Seu token expirou. Faça login novamente.', 401);
};

/**
 * Middleware para transformar erros conhecidos
 */
const transformKnownErrors = (err, req, res, next) => {
    let error = err;

    // Erros MySQL
    if (err.code && err.code.startsWith('ER_')) {
        error = handleMySQLError(err);
    }

    // Erros JWT
    if (err.name === 'JsonWebTokenError') {
        error = handleJWTError();
    }
    if (err.name === 'TokenExpiredError') {
        error = handleJWTExpiredError();
    }

    // Erros de validação do Express Validator
    if (err.errors && Array.isArray(err.errors)) {
        const messages = err.errors.map(e => e.msg).join(', ');
        error = new AppError(messages, 400);
    }

    next(error);
};

module.exports = {
    AppError,
    errorHandler,
    notFoundHandler,
    catchAsync,
    transformKnownErrors
};
