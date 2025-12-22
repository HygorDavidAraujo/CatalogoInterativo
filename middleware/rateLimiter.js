const rateLimit = require('express-rate-limit');

// Rate limiter para login (previne brute force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Não conta logins bem-sucedidos
});

// Rate limiter para cadastro (previne spam)
const cadastroLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 cadastros por hora
    message: { error: 'Muitos cadastros. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter para APIs gerais (previne DDoS)
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 requests por minuto
    message: { error: 'Muitas requisições. Aguarde um momento.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter para upload de imagens
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // 20 uploads
    message: { error: 'Muitos uploads. Aguarde 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    loginLimiter,
    cadastroLimiter,
    apiLimiter,
    uploadLimiter
};
