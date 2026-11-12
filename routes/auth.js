
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendMail: sendMailWithFallback, escapeHtml, getAppUrl } = require('../services/emailService');
const { verificarAutenticacao, verificarAdminAuth } = require('../middleware/auth');
const { loginLimiter, cadastroLimiter, recuperacaoLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validateCadastro, validatePerfil, validateId, validateRecuperacao } = require('../middleware/validators');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não definido. Configure uma chave forte no ambiente.');
}
// Rota antiga desativada: versões anteriores do site recebem uma orientação,
// sem consultar contas nem permitir troca de senha apenas pelo e-mail.
router.post('/atualizar-senha', (req, res) => {
    return res.status(410).json({
        error: 'Use a opção "Esqueci minha senha" para receber um link de recuperação por e-mail.',
        code: 'PASSWORD_RESET_REQUIRED'
    });
});

// POST - Login
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário por email
        const { rows: usuarios } = await pool.query(
            `SELECT id, nome_completo, telefone, email, senha, is_admin, is_vip, vip_tipo, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado 
             FROM usuarios WHERE email = $1`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        const usuario = usuarios[0];
        
        // Verificar senha (apenas bcrypt é aceito)
        if (!usuario.senha || !usuario.senha.startsWith('$2')) {
            return res.status(400).json({ 
                error: 'Sua senha precisa ser atualizada. Use a opção "Esqueci minha senha" para receber um link por e-mail.',
                code: 'PASSWORD_RESET_REQUIRED'
            });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }
        
        // Converter is_admin para booleano
        const isAdmin = usuario.is_admin === 1 || usuario.is_admin === true;
        
        // Gerar token JWT
        const sessaoId = crypto.randomUUID();
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, isAdmin },
            JWT_SECRET,
            { expiresIn: '7d', jwtid: sessaoId }
        );

        const expiraEm = new Date(jwt.decode(token).exp * 1000);
        const { rowCount } = await pool.query(
            `WITH usuario_atual AS (
                 SELECT id FROM usuarios
                 WHERE id = $2 AND senha = $4 AND is_admin IS NOT DISTINCT FROM $5
                 FOR SHARE
             )
             INSERT INTO sessoes_usuario (id, usuario_id, expira_em)
             SELECT $1, id, $3 FROM usuario_atual
             RETURNING id`,
            [sessaoId, usuario.id, expiraEm, usuario.senha, usuario.is_admin]
        );
        if (rowCount !== 1) {
            return res.status(401).json({ error: 'Seus dados de acesso foram alterados. Faça login novamente.' });
        }
        
        res.json({
            success: true,
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome_completo,
                telefone: usuario.telefone,
                email: usuario.email,
                isAdmin: isAdmin,
                is_vip: usuario.is_vip === 1 || usuario.is_vip === true,
                vip_tipo: usuario.vip_tipo,
                cpf: usuario.cpf,
                logradouro: usuario.logradouro,
                numero: usuario.numero,
                complemento: usuario.complemento,
                bairro: usuario.bairro,
                cep: usuario.cep,
                cidade: usuario.cidade,
                estado: usuario.estado
            }
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// POST - Encerrar somente a sessão autenticada, inclusive se o JWT foi copiado.
router.post('/logout', verificarAutenticacao, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM sessoes_usuario WHERE id = $1 AND usuario_id = $2',
            [req.sessaoId, req.usuario.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao encerrar sessão:', error);
        res.status(503).json({ error: 'Não foi possível encerrar sua sessão no servidor. Tente novamente.' });
    }
});

// GET - Dados do usuário autenticado
router.get('/me', verificarAutenticacao, async (req, res) => {
    try {
        const { rows: usuarios } = await pool.query(
            `SELECT id, nome_completo, telefone, email, is_admin, is_vip, vip_tipo, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado, created_at
             FROM usuarios WHERE id = $1`,
            [req.usuario.id]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const usuario = usuarios[0];
        res.json({
            id: usuario.id,
            nome: usuario.nome_completo,
            telefone: usuario.telefone,
            email: usuario.email,
            isAdmin: Boolean(usuario.is_admin),
            is_vip: Boolean(usuario.is_vip),
            vip_tipo: usuario.vip_tipo,
            cpf: usuario.cpf,
            logradouro: usuario.logradouro,
            numero: usuario.numero,
            complemento: usuario.complemento,
            bairro: usuario.bairro,
            cep: usuario.cep,
            cidade: usuario.cidade,
            estado: usuario.estado,
            created_at: usuario.created_at
        });
    } catch (error) {
        console.error('Erro ao buscar usuário autenticado:', error);
        res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
});

// POST - Cadastro
router.post('/cadastro', cadastroLimiter, validateCadastro, async (req, res) => {
    try {
        const { nome_completo, telefone, email, senha } = req.body;

        // Validações
        if (!nome_completo || !telefone || !email || !senha) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // Validar telefone (formato básico)
        const telefoneRegex = /^\(\d{2}\)\d{4,5}-\d{4}$/;
        if (!telefoneRegex.test(telefone)) {
            return res.status(400).json({ error: 'Telefone deve estar no formato (XX)XXXXX-XXXX' });
        }

        // Validar tamanho da senha
        if (senha.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        }

        // Verificar se email já existe
        const { rows: usuarioExistente } = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1',
            [email]
        );

        if (usuarioExistente.length > 0) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, 10);
        
        // Inserir novo usuário (nunca é admin por padrão)
        const result = await pool.query(
            'INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) VALUES ($1, $2, $3, $4, FALSE) RETURNING id',
            [nome_completo, telefone, email, senhaHash]
        );

        const { rows: novoUsuario } = await pool.query(
            'SELECT id, nome_completo, telefone, email, is_admin FROM usuarios WHERE id = $1',
            [result.rows[0].id]
        );

        res.status(201).json({
            success: true,
            usuario: {
                id: novoUsuario[0].id,
                nome: novoUsuario[0].nome_completo,
                telefone: novoUsuario[0].telefone,
                email: novoUsuario[0].email,
                isAdmin: Boolean(novoUsuario[0].is_admin)
            }
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ error: 'Erro ao cadastrar usuário' });
    }
});

// GET - Verificar se usuário está logado (usando session storage)
router.get('/verificar', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email não fornecido' });
        }

        const { rows: usuarios } = await pool.query(
            'SELECT id, nome_completo, telefone, email, is_admin FROM usuarios WHERE email = $1',
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const usuario = usuarios[0];
        
        res.json({
            success: true,
            usuario: {
                id: usuario.id,
                nome: usuario.nome_completo,
                telefone: usuario.telefone,
                email: usuario.email,
                isAdmin: Boolean(usuario.is_admin)
            }
        });
    } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        res.status(500).json({ error: 'Erro ao verificar usuário' });
    }
});

// GET - Listar todos os usuários (apenas para admin)
router.get('/usuarios', verificarAdminAuth, async (req, res) => {
    try {
        const { rows: usuarios } = await pool.query(
            `SELECT id, nome_completo, email, telefone, is_admin, is_vip, vip_tipo, created_at, 
             cpf, logradouro, numero, complemento, bairro, cep, cidade, estado 
             FROM usuarios ORDER BY created_at DESC`
        );
        
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// PUT - Atualizar perfil do usuário
router.put('/perfil', verificarAutenticacao, validatePerfil, async (req, res) => {
    try {
        const { 
            usuario_id, 
            nome, 
            telefone, 
            cpf, 
            logradouro, 
            numero, 
            complemento, 
            bairro, 
            cep, 
            cidade, 
            estado 
        } = req.body;

        if (!usuario_id) {
            return res.status(400).json({ error: 'ID do usuário é obrigatório' });
        }

        // Apenas o próprio usuário ou um admin pode alterar
        if (req.usuario.id !== Number(usuario_id) && !req.usuario.isAdmin) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        // Montar query de atualização dinamicamente
        const campos = [];
        const valores = [];

        if (nome !== undefined) {
            valores.push(nome);
            campos.push(`nome_completo = $${valores.length}`);
        }
        if (telefone !== undefined) {
            valores.push(telefone);
            campos.push(`telefone = $${valores.length}`);
        }
        if (cpf !== undefined) {
            valores.push(cpf);
            campos.push(`cpf = $${valores.length}`);
        }
        if (logradouro !== undefined) {
            valores.push(logradouro);
            campos.push(`logradouro = $${valores.length}`);
        }
        if (numero !== undefined) {
            valores.push(numero);
            campos.push(`numero = $${valores.length}`);
        }
        if (complemento !== undefined) {
            valores.push(complemento);
            campos.push(`complemento = $${valores.length}`);
        }
        if (bairro !== undefined) {
            valores.push(bairro);
            campos.push(`bairro = $${valores.length}`);
        }
        if (cep !== undefined) {
            valores.push(cep);
            campos.push(`cep = $${valores.length}`);
        }
        if (cidade !== undefined) {
            valores.push(cidade);
            campos.push(`cidade = $${valores.length}`);
        }
        if (estado !== undefined) {
            valores.push(estado);
            campos.push(`estado = $${valores.length}`);
        }

        if (campos.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        valores.push(usuario_id);

        const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length}`;
        
        await pool.query(query, valores);

        res.json({ success: true, message: 'Perfil atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// PUT - Atualizar usuário completo (apenas admin)
router.put('/usuarios/:id', verificarAdminAuth, async (req, res) => {
    try {
        const usuarioId = req.params.id;
        const { 
            nome, 
            telefone, 
            cpf, 
            logradouro, 
            numero, 
            complemento, 
            bairro, 
            cep, 
            cidade, 
            estado,
            is_admin,
            is_vip,
            vip_tipo
        } = req.body;

        // Verificar se usuário existe
        const { rows: usuarioExiste } = await pool.query('SELECT id, is_admin FROM usuarios WHERE id = $1', [usuarioId]);
        
        if (usuarioExiste.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Se estiver removendo privilégio admin, verificar se não é o último admin
        if (is_admin === false && usuarioExiste[0].is_admin) {
            const { rows: admins } = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios WHERE is_admin = TRUE');
            if (admins[0].total <= 1) {
                return res.status(400).json({ error: 'Não é possível remover o último administrador do sistema' });
            }
        }

        // Atualizar todos os campos
        await pool.query(
            `UPDATE usuarios SET 
                nome_completo = $1,
                telefone = $2,
                cpf = $3,
                logradouro = $4,
                numero = $5,
                complemento = $6,
                bairro = $7,
                cep = $8,
                cidade = $9,
                estado = $10,
                is_admin = $11,
                is_vip = $12,
                vip_tipo = $13
            WHERE id = $14`,
            [nome, telefone, cpf, logradouro, numero, complemento, bairro, cep, cidade, estado, is_admin, Boolean(is_vip), vip_tipo || null, usuarioId]
        );

        const { rows: usuarioAtualizado } = await pool.query(
            `SELECT id, nome_completo, email, telefone, is_admin, is_vip, vip_tipo, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado, created_at
             FROM usuarios WHERE id = $1`,
            [usuarioId]
        );

        res.json({ 
            success: true, 
            message: 'Usuário atualizado com sucesso',
            usuario: usuarioAtualizado[0]
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// ===== Rotas de recuperação de senha =====
// POST /auth/recuperar - solicita reset sem revelar contas cadastradas.
router.post('/recuperar', recuperacaoLimiter, validateRecuperacao, async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail válido é obrigatório' });

        const appUrl = getAppUrl();

        // Buscar usuário
        const { rows: usuarios } = await pool.query('SELECT id, email, nome_completo FROM usuarios WHERE email = $1', [email]);
        if (usuarios.length === 0) {
            // Responder sempre OK para evitar enumeração
            return res.json({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.' });
        }

        const usuario = usuarios[0];

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hora

        await pool.query('INSERT INTO password_resets (usuario_id, token, expires_at) VALUES ($1, $2, $3)', [usuario.id, token, expiresAt]);

        const resetLink = `${appUrl}/reset-senha.html?token=${token}`;

        // O serviço escolhe o remetente correto para cada provedor.
        const mailOptions = {
            to: usuario.email,
            subject: 'Recuperação de senha - Davini Vinhos',
            text: `Olá ${usuario.nome_completo || ''},\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link abaixo para criar uma nova senha (válido por 1 hora):\n\n${resetLink}\n\nSe você não solicitou, ignore esta mensagem.`,
            html: `<p>Olá ${escapeHtml(usuario.nome_completo)},</p><p>Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo para criar uma nova senha (válido por 1 hora):</p><p><a href="${escapeHtml(resetLink)}">Redefinir minha senha</a></p><p>Se você não solicitou, ignore esta mensagem.</p>`
        };

        const result = await sendMailWithFallback(mailOptions);
        if (!result.success) {
            console.error('[email] Recuperação não aceita pelo provedor ' + result.transporterType);
        }
        return res.json({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.' });
    } catch (error) {
        console.error('Erro em /auth/recuperar:', error);
        return res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
    }
});

// POST /auth/recuperar/confirmar - confirma token e troca senha
router.post('/recuperar/confirmar', async (req, res) => {
    try {
        const { token, novaSenha } = req.body;
        if (!token || !novaSenha) return res.status(400).json({ error: 'Token e novaSenha são obrigatórios' });
        if (typeof novaSenha !== 'string' || novaSenha.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });

        const { rows } = await pool.query('SELECT pr.id AS pr_id, pr.usuario_id, pr.expires_at, u.email FROM password_resets pr JOIN usuarios u ON pr.usuario_id = u.id WHERE pr.token = $1', [token]);
        if (rows.length === 0) return res.status(400).json({ error: 'Token inválido ou expirado' });

        const pr = rows[0];
        const now = new Date();
        if (new Date(pr.expires_at) < now) {
            // remover token expirado
            await pool.query('DELETE FROM password_resets WHERE id = $1', [pr.pr_id]);
            return res.status(400).json({ error: 'Token expirado' });
        }

        const hash = await bcrypt.hash(novaSenha, 10);
        await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, pr.usuario_id]);

        // remover todos tokens desse usuário
        await pool.query('DELETE FROM password_resets WHERE usuario_id = $1', [pr.usuario_id]);

        return res.json({ success: true, message: 'Senha atualizada com sucesso. Faça login com a nova senha.' });
    } catch (error) {
        console.error('Erro em /auth/recuperar/confirmar:', error);
        return res.status(500).json({ error: 'Erro ao confirmar recuperação de senha' });
    }
});

// GET apenas diagnostica. Envio exige POST autenticado de administrador.
router.get('/test-email', verificarAdminAuth, (req, res) => {
    let appUrlValida = true;
    try { getAppUrl(); } catch { appUrlValida = false; }
    res.json({
        resendConfigurado: Boolean(process.env.RESEND_API_KEY),
        resendRemetenteTeste: !process.env.RESEND_FROM || /@resend\.dev/i.test(process.env.RESEND_FROM),
        smtpConfigurado: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS &&
            (process.env.SMTP_HOST || /@(gmail|googlemail)\.com$/i.test(process.env.SMTP_USER))),
        appUrlValida,
        destinatarioLojaExplicito: Boolean(process.env.ORDER_NOTIFICATION_EMAIL)
    });
});
router.post('/test-email', verificarAdminAuth, async (req, res) => {
    if (typeof req.body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
        return res.status(400).json({ error: 'Informe um e-mail de destino válido' });
    }
    const result = await sendMailWithFallback({
        to: req.body.email.trim(), subject: 'Teste de e-mail - Davini Vinhos',
        text: 'Este é um teste de envio de e-mail do catálogo Davini Vinhos.'
    });
    return res.status(result.success ? 200 : 502).json({
        success: result.success, provider: result.transporterType,
        message: result.success ? 'E-mail aceito pelo provedor' : 'Falha no envio. Verifique a configuração dos provedores.'
    });
});

module.exports = router;
