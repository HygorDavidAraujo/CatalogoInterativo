const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// POST - Login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário por email e senha
        const [usuarios] = await pool.query(
            'SELECT id, nome_completo, telefone, email, is_admin FROM usuarios WHERE email = ? AND senha = ?',
            [email, senha]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        const usuario = usuarios[0];
        
        // Converter is_admin para booleano (MySQL retorna 0 ou 1)
        const isAdmin = usuario.is_admin === 1 || usuario.is_admin === true;
        
        console.log('Login - is_admin no BD:', usuario.is_admin, 'Convertido:', isAdmin);
        
        res.json({
            success: true,
            usuario: {
                id: usuario.id,
                nome: usuario.nome_completo,
                telefone: usuario.telefone,
                email: usuario.email,
                isAdmin: isAdmin
            }
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
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

        // Inserir novo usuário (nunca é admin por padrão)
        const [result] = await pool.query(
            'INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) VALUES (?, ?, ?, ?, FALSE)',
            [nome_completo, telefone, email, senha]
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
router.get('/usuarios', async (req, res) => {
    try {
        const [usuarios] = await pool.query(
            'SELECT id, nome_completo, email, telefone, is_admin, created_at FROM usuarios ORDER BY created_at DESC'
        );
        
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

module.exports = router;
