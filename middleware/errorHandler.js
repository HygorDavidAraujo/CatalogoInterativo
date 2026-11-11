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

function redigirSegredos(value) {
    if (typeof value !== 'string') return value;
    const chaves = ['DATABASE_URL', 'JWT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'SMTP_PASS', 'RESEND_API_KEY'];
    return chaves.reduce((texto, chave) => {
        const segredo = process.env[chave]?.trim();
        return segredo ? texto.split(segredo).join('[REDACTED]') : texto;
    }, value);
}

/**
 * Middleware global de tratamento de erros
 * Deve ser o último middleware registrado no Express
 */
const errorHandler = (err, req, res, next) => {
    const logger = require('../config/logger');
    if (!err || typeof err !== 'object') {
        err = new Error(typeof err === 'string' ? err : 'Erro interno do servidor');
    }
    
    // Define valores padrão
    const statusCode = Number(err.statusCode || err.status);
    err.statusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
    err.message = err.message || 'Erro interno do servidor';

    const contexto = {
        errorMessage: redigirSegredos(err.message),
        causeMessage: redigirSegredos(typeof err.cause === 'string' ? err.cause : err.cause?.message),
        code: err.code,
        causeCode: err.cause?.code,
        providerStatus: err.cause?.http_code,
        missingVariables: err.missingVariables,
        etapa: req.etapaOperacao,
        url: req.originalUrl,
        method: req.method,
        statusCode: err.statusCode,
        userId: req.usuario?.id
    };

    // Log do erro
    if (err.statusCode >= 500) {
        logger.error('Erro no servidor', { ...contexto, stack: redigirSegredos(err.stack) });
    } else {
        logger.warn('Erro do cliente', contexto);
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
            code: err.code,
            timestamp: err.timestamp
        });
    }

    // Erros de programação ou desconhecidos - não expor detalhes
    return res.status(err.statusCode).json({
        status: 'error',
        message: err.statusCode < 500 ? 'Não foi possível processar os dados enviados.' : 'Algo deu errado. Tente novamente mais tarde.',
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
 * Transformar erros comuns do PostgreSQL em erros operacionais
 */
const handlePostgresError = (err) => {
    if (err.code === '23505') {
        return new AppError('Este registro já existe no sistema', 409);
    }
    if (err.code === '23503') {
        return new AppError('Referência inválida no banco de dados', 400);
    }
    if (err.code === '23502' || err.code === '22P02') {
        return new AppError('Os dados informados são inválidos ou incompletos', 400);
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
    if (!err || typeof err !== 'object') {
        err = new Error(typeof err === 'string' ? err : 'Erro interno do servidor');
    }
    let error = err;

    if (err.name === 'MulterError') {
        error = new AppError(
            err.code === 'LIMIT_FILE_SIZE'
                ? 'A imagem excede o limite de 5 MB.'
                : 'Não foi possível receber a imagem. Selecione um arquivo válido novamente.',
            err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
        );
        error.code = err.code;
        error.cause = err;
    }
    if (err.type === 'entity.too.large') error = new AppError('A solicitação excede o limite de tamanho permitido.', 413);
    if (err.type === 'entity.parse.failed') error = new AppError('Os dados enviados não são válidos.', 400);

    if (err.code && /^[0-9A-Z]{5}$/.test(err.code)) {
        error = handlePostgresError(err);
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
