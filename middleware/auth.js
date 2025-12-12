const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'davini-vinhos-secret-key-2024';

// Middleware para verificar se está autenticado
function verificarAutenticacao(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

// Middleware para verificar se é admin
function verificarAdmin(req, res, next) {
    if (!req.usuario || !req.usuario.isAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

// Middleware combinado: verificar autenticação E admin
function verificarAdminAuth(req, res, next) {
    verificarAutenticacao(req, res, (err) => {
        if (err) return;
        verificarAdmin(req, res, next);
    });
}

module.exports = {
    verificarAutenticacao,
    verificarAdmin,
    verificarAdminAuth
};
