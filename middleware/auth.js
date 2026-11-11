const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não definido. Configure uma chave forte no ambiente.');
}

// Middleware para verificar se está autenticado
async function verificarAutenticacao(req, res, next) {
    const authorization = req.headers.authorization;
    const token = typeof authorization === 'string'
        ? authorization.match(/^Bearer (\S+)$/i)?.[1]
        : null;
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        if (!Number.isInteger(decoded.id) || decoded.id < 1 || decoded.id > 2147483647 ||
            typeof decoded.jti !== 'string' ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(decoded.jti)) {
            return res.status(401).json({ error: 'Sua sessão expirou. Faça login novamente.' });
        }
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    let usuario;
    try {
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.is_admin
             FROM sessoes_usuario s
             JOIN usuarios u ON u.id = s.usuario_id
             WHERE s.id = $1 AND s.usuario_id = $2 AND s.expira_em > CURRENT_TIMESTAMP`,
            [decoded.jti, decoded.id]
        );
        usuario = rows[0];
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        return res.status(503).json({ error: 'Não foi possível verificar sua sessão. Tente novamente.' });
    }

    if (!usuario) {
        return res.status(401).json({ error: 'Sua sessão expirou. Faça login novamente.' });
    }

    // Permissões atuais do banco prevalecem sobre o conteúdo do JWT.
    req.usuario = {
        ...decoded,
        id: usuario.id,
        email: usuario.email,
        isAdmin: usuario.is_admin === true || usuario.is_admin === 1
    };
    req.sessaoId = decoded.jti;
    return next();
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
    return verificarAutenticacao(req, res, (err) => {
        if (err) return;
        verificarAdmin(req, res, next);
    });
}

module.exports = {
    verificarAutenticacao,
    verificarAdmin,
    verificarAdminAuth
};
