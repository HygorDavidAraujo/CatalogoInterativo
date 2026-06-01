
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}
const { verificarAutenticacao, verificarAdminAuth } = require('../middleware/auth');
const { loginLimiter, cadastroLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validateCadastro, validatePerfil, validateId } = require('../middleware/validators');

const JWT_SECRET = process.env.JWT_SECRET || 'davini-vinhos-secret-key-2024';

// POST - Atualizar senha antiga para bcrypt
router.post('/atualizar-senha', async (req, res) => {
    try {
        const { email, novaSenha } = req.body;
        if (!email || !novaSenha) {
            return res.status(400).json({ error: 'Email e nova senha são obrigatórios.' });
        }
        // Buscar usuário
        const [usuarios] = await pool.query('SELECT id, senha FROM usuarios WHERE email = ?', [email]);
        if (usuarios.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        const usuario = usuarios[0];
        // Só permite atualizar se a senha antiga não for bcrypt
        if (usuario.senha && usuario.senha.startsWith('$2')) {
            return res.status(400).json({ error: 'Senha já está atualizada.' });
        }
        // Gerar hash bcrypt
        const hash = await bcrypt.hash(novaSenha, 10);
        await pool.query('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, usuario.id]);
        res.json({ success: true, message: 'Senha atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        res.status(500).json({ error: 'Erro ao atualizar senha.' });
    }
});

// POST - Login
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário por email
        const [usuarios] = await pool.query(
            `SELECT id, nome_completo, telefone, email, senha, is_admin, is_vip, vip_tipo, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado 
             FROM usuarios WHERE email = ?`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        const usuario = usuarios[0];
        
        // Verificar senha (apenas bcrypt é aceito)
        if (!usuario.senha || !usuario.senha.startsWith('$2')) {
            return res.status(400).json({ 
                error: 'Sua senha precisa ser atualizada. Contate um administrador para resetar seu acesso com hash bcrypt.' 
            });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }
        
        // Converter is_admin para booleano
        const isAdmin = usuario.is_admin === 1 || usuario.is_admin === true;
        
        // Gerar token JWT
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, isAdmin },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
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

// GET - Dados do usuário autenticado
router.get('/me', verificarAutenticacao, async (req, res) => {
    try {
        const [usuarios] = await pool.query(
            `SELECT id, nome_completo, telefone, email, is_admin, is_vip, vip_tipo, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado, created_at
             FROM usuarios WHERE id = ?`,
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
        const [usuarioExistente] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (usuarioExistente.length > 0) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, 10);
        
        // Inserir novo usuário (nunca é admin por padrão)
        const [result] = await pool.query(
            'INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) VALUES (?, ?, ?, ?, FALSE)',
            [nome_completo, telefone, email, senhaHash]
        );

        const [novoUsuario] = await pool.query(
            'SELECT id, nome_completo, telefone, email, is_admin FROM usuarios WHERE id = ?',
            [result.insertId]
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

        const [usuarios] = await pool.query(
            'SELECT id, nome_completo, telefone, email, is_admin FROM usuarios WHERE email = ?',
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
        const [usuarios] = await pool.query(
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
            campos.push('nome_completo = ?');
            valores.push(nome);
        }
        if (telefone !== undefined) {
            campos.push('telefone = ?');
            valores.push(telefone);
        }
        if (cpf !== undefined) {
            campos.push('cpf = ?');
            valores.push(cpf);
        }
        if (logradouro !== undefined) {
            campos.push('logradouro = ?');
            valores.push(logradouro);
        }
        if (numero !== undefined) {
            campos.push('numero = ?');
            valores.push(numero);
        }
        if (complemento !== undefined) {
            campos.push('complemento = ?');
            valores.push(complemento);
        }
        if (bairro !== undefined) {
            campos.push('bairro = ?');
            valores.push(bairro);
        }
        if (cep !== undefined) {
            campos.push('cep = ?');
            valores.push(cep);
        }
        if (cidade !== undefined) {
            campos.push('cidade = ?');
            valores.push(cidade);
        }
        if (estado !== undefined) {
            campos.push('estado = ?');
            valores.push(estado);
        }

        if (campos.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        valores.push(usuario_id);

        const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;
        
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
        const [usuarioExiste] = await pool.query('SELECT id, is_admin FROM usuarios WHERE id = ?', [usuarioId]);
        
        if (usuarioExiste.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Se estiver removendo privilégio admin, verificar se não é o último admin
        if (is_admin === false && usuarioExiste[0].is_admin) {
            const [admins] = await pool.query('SELECT COUNT(*) as total FROM usuarios WHERE is_admin = TRUE');
            if (admins[0].total <= 1) {
                return res.status(400).json({ error: 'Não é possível remover o último administrador do sistema' });
            }
        }

        // Atualizar todos os campos
        await pool.query(
            `UPDATE usuarios SET 
                nome_completo = ?, 
                telefone = ?, 
                cpf = ?, 
                logradouro = ?, 
                numero = ?, 
                complemento = ?, 
                bairro = ?, 
                cep = ?, 
                cidade = ?, 
                estado = ?,
                is_admin = ?,
                is_vip = ?,
                vip_tipo = ?
            WHERE id = ?`,
            [nome, telefone, cpf, logradouro, numero, complemento, bairro, cep, cidade, estado, is_admin, is_vip ? 1 : 0, vip_tipo || null, usuarioId]
        );

        const [usuarioAtualizado] = await pool.query(
            `SELECT id, nome_completo, email, telefone, is_admin, is_vip, vip_tipo, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado, created_at
             FROM usuarios WHERE id = ?`,
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

module.exports = router;

// ===== Rotas de recuperação de senha =====
// POST /auth/recuperar - solicita reset de senha (gera token, grava em password_resets e envia e-mail/console)
router.post('/recuperar', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });

        // Buscar usuário
        const [usuarios] = await pool.query('SELECT id, email, nome_completo FROM usuarios WHERE email = ?', [email]);
        if (usuarios.length === 0) {
            // Responder sempre OK para evitar enumeração
            return res.json({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.' });
        }

        const usuario = usuarios[0];

        // Garantir tabela password_resets existe
        await pool.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                token VARCHAR(128) NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (usuario_id),
                INDEX (token)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hora

        await pool.query('INSERT INTO password_resets (usuario_id, token, expires_at) VALUES (?, ?, ?)', [usuario.id, token, expiresAt]);

        const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        const resetLink = `${appUrl}/reset-senha.html?token=${token}`;

        // Tentar enviar por e-mail se nodemailer disponível
        if (nodemailer) {
            // Prefer explicit SMTP_HOST/PORT if configurado
            let transporter;
            try {
                if (process.env.SMTP_HOST) {
                    transporter = nodemailer.createTransport({
                        host: process.env.SMTP_HOST,
                        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
                        secure: process.env.SMTP_SECURE === 'true',
                        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
                    });
                } else if (process.env.SMTP_USER && process.env.SMTP_USER.endsWith('@gmail.com') && process.env.SMTP_PASS) {
                    // Convenience: support Gmail using App Password (recommended)
                    transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                    });
                }

                if (transporter) {
                    const mailOptions = {
                        from: process.env.SMTP_FROM || `Davini Vinhos <${process.env.SMTP_USER || ('noreply@' + (process.env.APP_HOST || 'localhost'))}>`,
                        to: usuario.email,
                        subject: 'Recuperação de senha - Davini Vinhos',
                        text: `Olá ${usuario.nome_completo || ''},\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link abaixo para criar uma nova senha (válido por 1 hora):\n\n${resetLink}\n\nSe você não solicitou, ignore esta mensagem.`,
                        html: `<p>Olá ${usuario.nome_completo || ''},</p><p>Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo para criar uma nova senha (válido por 1 hora):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Se você não solicitou, ignore esta mensagem.</p>`
                    };

                    try {
                        const info = await transporter.sendMail(mailOptions);
                        console.log(`✓ E-mail de recuperação enviado para ${usuario.email}:`, info.response || info);
                    } catch (err) {
                        console.error(`✗ Erro ao enviar e-mail de recuperação para ${usuario.email}:`, err.message || err);
                        // Continua mesmo se falhar (token já foi criado)
                    }

                    return res.json({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.' });
                }
            } catch (mailErr) {
                console.error('Erro ao tentar enviar e-mail via nodemailer:', mailErr);
            }
        }

        // Fallback: logar o link no console (útil em desenvolvimento sem SMTP)
        console.log(`Password reset link for ${usuario.email}: ${resetLink}`);

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

        const [rows] = await pool.query('SELECT pr.id AS pr_id, pr.usuario_id, pr.expires_at, u.email FROM password_resets pr JOIN usuarios u ON pr.usuario_id = u.id WHERE pr.token = ?', [token]);
        if (rows.length === 0) return res.status(400).json({ error: 'Token inválido ou expirado' });

        const pr = rows[0];
        const now = new Date();
        if (new Date(pr.expires_at) < now) {
            // remover token expirado
            await pool.query('DELETE FROM password_resets WHERE id = ?', [pr.pr_id]);
            return res.status(400).json({ error: 'Token expirado' });
        }

        const hash = await bcrypt.hash(novaSenha, 10);
        await pool.query('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, pr.usuario_id]);

        // remover todos tokens desse usuário
        await pool.query('DELETE FROM password_resets WHERE usuario_id = ?', [pr.usuario_id]);

        return res.json({ success: true, message: 'Senha atualizada com sucesso. Faça login com a nova senha.' });
    } catch (error) {
        console.error('Erro em /auth/recuperar/confirmar:', error);
        return res.status(500).json({ error: 'Erro ao confirmar recuperação de senha' });
    }
});

// GET /auth/test-email - Endpoint de diagnóstico SMTP (apenas em desenvolvimento)
router.get('/test-email', async (req, res) => {
    try {
        // Apenas em desenvolvimento
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Endpoint não disponível em produção' });
        }

        const results = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            smtp: {
                user: process.env.SMTP_USER || 'NÃO DEFINIDO',
                pass: process.env.SMTP_PASS ? '***DEFINIDO***' : 'NÃO DEFINIDO',
                port: process.env.SMTP_PORT || 'NÃO DEFINIDO',
                secure: process.env.SMTP_SECURE || 'NÃO DEFINIDO',
                from: process.env.SMTP_FROM || 'NÃO DEFINIDO',
                appUrl: process.env.APP_URL || 'NÃO DEFINIDO'
            },
            test: {}
        };

        // Verificar se nodemailer está disponível
        if (!nodemailer) {
            results.test.error = 'Nodemailer não instalado';
            return res.json(results);
        }

        // Criar transporter
        let transporter;
        if (process.env.SMTP_USER && process.env.SMTP_USER.endsWith('@gmail.com') && process.env.SMTP_PASS) {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
        } else if (process.env.SMTP_HOST) {
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
            });
        } else {
            results.test.error = 'SMTP não configurado (faltam SMTP_USER/SMTP_PASS ou SMTP_HOST)';
            return res.json(results);
        }

        // Testar verificação
        try {
            await transporter.verify();
            results.test.verify = '✓ Conexão SMTP verificada com sucesso';
        } catch (err) {
            results.test.verify_error = err.message || String(err);
            return res.json(results);
        }

        // Enviar e-mail de teste
        try {
            const testEmail = process.env.SMTP_USER;
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || `Teste <${testEmail}>`,
                to: testEmail,
                subject: 'Teste SMTP - Catálogo Interativo',
                text: `Teste de e-mail enviado em ${new Date().toISOString()}`
            });
            results.test.sendMail = '✓ E-mail de teste enviado com sucesso';
            results.test.sendMail_response = info.response || String(info);
        } catch (err) {
            results.test.sendMail_error = err.message || String(err);
        }

        res.json(results);
    } catch (error) {
        console.error('Erro em /auth/test-email:', error);
        res.status(500).json({ error: 'Erro ao testar e-mail', details: error.message });
    }
});

module.exports = router;
