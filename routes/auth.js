const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verificarAutenticacao, verificarAdminAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'davini-vinhos-secret-key-2024';

// POST - Login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário por email
        const [usuarios] = await pool.query(
            `SELECT id, nome_completo, telefone, email, senha, is_admin, cpf,
                    logradouro, numero, complemento, bairro, cep, cidade, estado 
             FROM usuarios WHERE email = ?`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        const usuario = usuarios[0];
        
        // Verificar senha (suporta hash bcrypt e plaintext para transição)
        // Apenas senhas com hash são aceitas; força redefinição se legado
        if (!usuario.senha.startsWith('$2')) {
            return res.status(400).json({ error: 'Senha precisa ser redefinida. Contate um administrador para resetar seu acesso.' });
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
            `SELECT id, nome_completo, telefone, email, is_admin, cpf,
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
router.post('/cadastro', async (req, res) => {
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
            `SELECT id, nome_completo, email, telefone, is_admin, created_at, 
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
router.put('/perfil', verificarAutenticacao, async (req, res) => {
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
            is_admin
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
                is_admin = ?
            WHERE id = ?`,
            [nome, telefone, cpf, logradouro, numero, complemento, bairro, cep, cidade, estado, is_admin, usuarioId]
        );

        const [usuarioAtualizado] = await pool.query(
            `SELECT id, nome_completo, email, telefone, is_admin, cpf,
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
