const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

// Criar diretório de uploads se não existir
const uploadDir = path.join(__dirname, '../uploads/vinhos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'vinho-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});

// GET - Listar todos os vinhos
router.get('/', async (req, res) => {
    try {
        const [vinhos] = await pool.query('SELECT * FROM vinhos ORDER BY created_at DESC');
        res.json(vinhos);
    } catch (error) {
        console.error('Erro ao buscar vinhos:', error);
        res.status(500).json({ error: 'Erro ao buscar vinhos' });
    }
});

// GET - Buscar vinho por ID
router.get('/:id', async (req, res) => {
    try {
        const [vinhos] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [req.params.id]);
        
        if (vinhos.length === 0) {
            return res.status(404).json({ error: 'Vinho não encontrado' });
        }
        
        res.json(vinhos[0]);
    } catch (error) {
        console.error('Erro ao buscar vinho:', error);
        res.status(500).json({ error: 'Erro ao buscar vinho' });
    }
});

// POST - Criar novo vinho (com upload de imagem)
router.post('/', upload.single('imagem'), async (req, res) => {
    try {
        const { nome, tipo, uva, ano, guarda, harmonizacao, descricao, preco, imagemUrl } = req.body;

        // Verificar campos obrigatórios
        if (!nome || !tipo || !uva || !ano || !preco) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        // Usar imagem do upload ou URL fornecida
        let imagemPath = imagemUrl || '';
        if (req.file) {
            imagemPath = `/uploads/vinhos/${req.file.filename}`;
        }

        const [result] = await pool.query(
            'INSERT INTO vinhos (nome, tipo, uva, ano, guarda, harmonizacao, descricao, preco, imagem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, tipo, uva, ano, guarda || '', harmonizacao || '', descricao || '', preco, imagemPath]
        );

        const [novoVinho] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [result.insertId]);
        
        res.status(201).json(novoVinho[0]);
    } catch (error) {
        console.error('Erro ao criar vinho:', error);
        res.status(500).json({ error: 'Erro ao criar vinho' });
    }
});

// PUT - Atualizar vinho
router.put('/:id', upload.single('imagem'), async (req, res) => {
    try {
        const { nome, tipo, uva, ano, guarda, harmonizacao, descricao, preco, imagemUrl } = req.body;
        const id = req.params.id;

        // Buscar vinho atual
        const [vinhoAtual] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
        
        if (vinhoAtual.length === 0) {
            return res.status(404).json({ error: 'Vinho não encontrado' });
        }

        // Determinar qual imagem usar
        let imagemPath = vinhoAtual[0].imagem;
        
        if (req.file) {
            // Nova imagem foi enviada via upload
            imagemPath = `/uploads/vinhos/${req.file.filename}`;
            
            // Deletar imagem antiga se for local
            if (vinhoAtual[0].imagem && vinhoAtual[0].imagem.startsWith('/uploads/')) {
                const oldImagePath = path.join(__dirname, '..', vinhoAtual[0].imagem);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        } else if (imagemUrl) {
            // URL foi fornecida
            imagemPath = imagemUrl;
        }

        await pool.query(
            'UPDATE vinhos SET nome = ?, tipo = ?, uva = ?, ano = ?, guarda = ?, harmonizacao = ?, descricao = ?, preco = ?, imagem = ? WHERE id = ?',
            [nome, tipo, uva, ano, guarda || '', harmonizacao || '', descricao || '', preco, imagemPath, id]
        );

        const [vinhoAtualizado] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
        
        res.json(vinhoAtualizado[0]);
    } catch (error) {
        console.error('Erro ao atualizar vinho:', error);
        res.status(500).json({ error: 'Erro ao atualizar vinho' });
    }
});

// DELETE - Deletar vinho
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Buscar vinho para deletar imagem se necessário
        const [vinho] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
        
        if (vinho.length === 0) {
            return res.status(404).json({ error: 'Vinho não encontrado' });
        }

        // Deletar imagem se for local
        if (vinho[0].imagem && vinho[0].imagem.startsWith('/uploads/')) {
            const imagePath = path.join(__dirname, '..', vinho[0].imagem);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await pool.query('DELETE FROM vinhos WHERE id = ?', [id]);
        
        res.json({ message: 'Vinho deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar vinho:', error);
        res.status(500).json({ error: 'Erro ao deletar vinho' });
    }
});

// GET - Filtrar vinhos por tipo
router.get('/tipo/:tipo', async (req, res) => {
    try {
        const [vinhos] = await pool.query(
            'SELECT * FROM vinhos WHERE tipo = ? ORDER BY created_at DESC',
            [req.params.tipo]
        );
        res.json(vinhos);
    } catch (error) {
        console.error('Erro ao filtrar vinhos:', error);
        res.status(500).json({ error: 'Erro ao filtrar vinhos' });
    }
});

module.exports = router;
