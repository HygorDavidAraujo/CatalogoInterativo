const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { upload, cloudinary } = require('../config/cloudinary');
const { verificarAdminAuth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { validateVinho, validateId } = require('../middleware/validators');

// GET - Listar todos os vinhos (área pública mostra apenas ativos)
router.get('/', async (req, res) => {
    try {
        const mostrarInativos = req.query.admin === 'true';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const orderBy = req.query.orderBy || 'created_at';
        const order = req.query.order || 'DESC';
        
        // Validar orderBy para prevenir SQL injection
        const validOrderBy = ['created_at', 'nome', 'preco', 'ano'];
        const validOrder = ['ASC', 'DESC'];
        
        const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'created_at';
        const safeOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
        
        // Query base
        let whereClause = '';
        if (!mostrarInativos) {
            whereClause = ' WHERE (ativo = TRUE OR ativo IS NULL)';
        }
        
        // Contar total
        const countQuery = `SELECT COUNT(*) as total FROM vinhos${whereClause}`;
        const [countResult] = await pool.query(countQuery);
        const total = countResult[0].total;
        
        // Buscar vinhos com paginação
        const query = `SELECT * FROM vinhos${whereClause} ORDER BY ${safeOrderBy} ${safeOrder} LIMIT ? OFFSET ?`;
        const [vinhos] = await pool.query(query, [limit, offset]);
        
        res.json({
            data: vinhos,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
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

// POST - Criar novo vinho (admin only, com upload de imagem no Cloudinary)
router.post('/', verificarAdminAuth, uploadLimiter, upload.single('imagem'), validateVinho, async (req, res) => {
    try {
        const { nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagemUrl, ativo } = req.body;

        // Verificar campos obrigatórios
        if (!nome || !tipo || !uva || !ano || !preco) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        // Usar imagem do Cloudinary, URL fornecida ou vazio
        let imagemPath = imagemUrl || '';
        if (req.file) {
            // Cloudinary retorna a URL completa em req.file.path
            imagemPath = req.file.path;
        }

        // Converter ativo para boolean (vem como string do FormData)
        const ativoBoolean = ativo === 'true' || ativo === true || ativo === '1';

        const [result] = await pool.query(
            'INSERT INTO vinhos (nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, tipo, uva, pais_origem || null, pais_codigo || null, bandeira_url || null, ano, guarda || '', harmonizacao || '', descricao || '', preco, imagemPath, ativoBoolean]
        );

        const [novoVinho] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [result.insertId]);
        
        res.status(201).json(novoVinho[0]);
    } catch (error) {
        console.error('Erro ao criar vinho:', error);
        res.status(500).json({ error: 'Erro ao criar vinho', details: error.message });
    }
});

// PUT - Atualizar vinho (admin only, com upload no Cloudinary)
router.put('/:id', verificarAdminAuth, uploadLimiter, validateId, upload.single('imagem'), validateVinho, async (req, res) => {
    try {
        const { nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagemUrl, ativo } = req.body;
        const id = req.params.id;

        // Buscar vinho atual
        const [vinhoAtual] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
        
        if (vinhoAtual.length === 0) {
            return res.status(404).json({ error: 'Vinho não encontrado' });
        }

        // Determinar qual imagem usar
        let imagemPath = vinhoAtual[0].imagem;
        
        if (req.file) {
            // Nova imagem foi enviada via upload para Cloudinary
            imagemPath = req.file.path;
            
            // Deletar imagem antiga do Cloudinary se existir
            if (vinhoAtual[0].imagem && vinhoAtual[0].imagem.includes('cloudinary.com')) {
                try {
                    // Extrair public_id da URL do Cloudinary
                    const urlParts = vinhoAtual[0].imagem.split('/');
                    const publicIdWithExt = urlParts[urlParts.length - 1];
                    const publicId = `vinhos/${publicIdWithExt.split('.')[0]}`;
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.log('Erro ao deletar imagem antiga do Cloudinary:', err.message);
                }
            }
        } else if (imagemUrl) {
            // URL foi fornecida
            imagemPath = imagemUrl;
        }

        // Converter ativo para boolean
        let ativoBoolean;
        if (ativo === undefined || ativo === null) {
            ativoBoolean = true; // Default para true se não fornecido
        } else if (ativo === 'false' || ativo === false || ativo === '0' || ativo === 0) {
            ativoBoolean = false;
        } else {
            ativoBoolean = true;
        }

        console.log('Atualizando vinho:', { id, ativo: ativoBoolean, ativoOriginal: ativo, tipoAtivo: typeof ativo });

        await pool.query(
            'UPDATE vinhos SET nome = ?, tipo = ?, uva = ?, pais_origem = ?, pais_codigo = ?, bandeira_url = ?, ano = ?, guarda = ?, harmonizacao = ?, descricao = ?, preco = ?, imagem = ?, ativo = ? WHERE id = ?',
            [nome, tipo, uva, pais_origem || null, pais_codigo || null, bandeira_url || null, ano, guarda || '', harmonizacao || '', descricao || '', preco, imagemPath, ativoBoolean, id]
        );

        const [vinhoAtualizado] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
        
        console.log('Vinho atualizado:', vinhoAtualizado[0]);
        
        res.json(vinhoAtualizado[0]);
    } catch (error) {
        console.error('Erro ao atualizar vinho:', error);
        res.status(500).json({ error: 'Erro ao atualizar vinho' });
    }
});

// DELETE - Deletar vinho (admin only, e imagem do Cloudinary)
router.delete('/:id', verificarAdminAuth, validateId, async (req, res) => {
    try {
        const id = req.params.id;

        // Buscar vinho para deletar imagem do Cloudinary
        const [vinho] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
        
        if (vinho.length === 0) {
            return res.status(404).json({ error: 'Vinho não encontrado' });
        }

        // Deletar imagem do Cloudinary se existir
        if (vinho[0].imagem && vinho[0].imagem.includes('cloudinary.com')) {
            try {
                // Extrair public_id da URL do Cloudinary
                const urlParts = vinho[0].imagem.split('/');
                const publicIdWithExt = urlParts[urlParts.length - 1];
                const publicId = `vinhos/${publicIdWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.log('Erro ao deletar imagem do Cloudinary:', err.message);
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
