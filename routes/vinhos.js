const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { upload, cloudinary } = require('../config/cloudinary');
const { verificarAdminAuth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { validateVinho, validateVinhoUpdate, validateId } = require('../middleware/validatorsZod');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const cacheService = require('../services/cacheService');
const logger = require('../config/logger');

// GET - Listar todos os vinhos (área pública mostra apenas ativos) - COM CACHE
router.get('/', cacheService.cacheMiddleware(300), catchAsync(async (req, res) => {
    const mostrarInativos = req.query.admin === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Máximo 100
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
}));

// GET - Buscar vinho por ID - COM CACHE
router.get('/:id', validateId, cacheService.cacheMiddleware(600), catchAsync(async (req, res) => {
    const [vinhos] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [req.params.id]);
    
    if (vinhos.length === 0) {
        throw new AppError('Vinho não encontrado', 404);
    }
    
    res.json(vinhos[0]);
}));

// POST - Criar novo vinho (admin only, com upload de imagem no Cloudinary)
router.post('/', verificarAdminAuth, uploadLimiter, upload.single('imagem'), validateVinho, catchAsync(async (req, res) => {
    const { nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagemUrl, ativo, estoque } = req.body;

    // Usar imagem do Cloudinary, URL fornecida ou vazio
    let imagemPath = imagemUrl || '';
    if (req.file) {
        imagemPath = req.file.path;
    }

    // Converter ativo para boolean
    const ativoBoolean = ativo === 'true' || ativo === true || ativo === '1';

    const [result] = await pool.query(
        'INSERT INTO vinhos (nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagem, ativo, estoque) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nome, tipo, uva, pais_origem || null, pais_codigo || null, bandeira_url || null, ano, guarda || '', harmonizacao || '', descricao || '', preco, imagemPath, ativoBoolean, estoque || 0]
    );

    const [novoVinho] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [result.insertId]);
    
    // Invalidar cache de vinhos
    await cacheService.invalidateVinhosCache();
    logger.info(`Vinho criado: ${nome} (ID: ${result.insertId})`);
    
    res.status(201).json(novoVinho[0]);
}));

// PUT - Atualizar vinho (admin only, com upload no Cloudinary)
router.put('/:id', verificarAdminAuth, uploadLimiter, validateId, upload.single('imagem'), validateVinhoUpdate, catchAsync(async (req, res) => {
    const { nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagemUrl, ativo, estoque } = req.body;
    const id = req.params.id;

    // Buscar vinho atual
    const [vinhoAtual] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
    
    if (vinhoAtual.length === 0) {
        throw new AppError('Vinho não encontrado', 404);
    }

    // Determinar qual imagem usar
    let imagemPath = vinhoAtual[0].imagem;
    
    if (req.file) {
        imagemPath = req.file.path;
        
        // Deletar imagem antiga do Cloudinary se existir
        if (vinhoAtual[0].imagem && vinhoAtual[0].imagem.includes('cloudinary.com')) {
            try {
                const urlParts = vinhoAtual[0].imagem.split('/');
                const publicIdWithExt = urlParts[urlParts.length - 1];
                const publicId = `vinhos/${publicIdWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                logger.warn('Erro ao deletar imagem antiga do Cloudinary:', err.message);
            }
        }
    } else if (imagemUrl) {
        imagemPath = imagemUrl;
    }

    // Converter ativo para boolean
    let ativoBoolean = vinhoAtual[0].ativo;
    if (ativo !== undefined && ativo !== null) {
        ativoBoolean = ativo === 'true' || ativo === true || ativo === '1';
    }

    await pool.query(
        'UPDATE vinhos SET nome = ?, tipo = ?, uva = ?, pais_origem = ?, pais_codigo = ?, bandeira_url = ?, ano = ?, guarda = ?, harmonizacao = ?, descricao = ?, preco = ?, imagem = ?, ativo = ?, estoque = ? WHERE id = ?',
        [
            nome || vinhoAtual[0].nome,
            tipo || vinhoAtual[0].tipo,
            uva || vinhoAtual[0].uva,
            pais_origem !== undefined ? pais_origem : vinhoAtual[0].pais_origem,
            pais_codigo !== undefined ? pais_codigo : vinhoAtual[0].pais_codigo,
            bandeira_url !== undefined ? bandeira_url : vinhoAtual[0].bandeira_url,
            ano !== undefined ? ano : vinhoAtual[0].ano,
            guarda !== undefined ? guarda : vinhoAtual[0].guarda,
            harmonizacao !== undefined ? harmonizacao : vinhoAtual[0].harmonizacao,
            descricao !== undefined ? descricao : vinhoAtual[0].descricao,
            preco !== undefined ? preco : vinhoAtual[0].preco,
            imagemPath,
            ativoBoolean,
            estoque !== undefined ? estoque : vinhoAtual[0].estoque,
            id
        ]
    );

    const [vinhoAtualizado] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
    
    // Invalidar cache
    await cacheService.invalidateVinhosCache();
    logger.info(`Vinho atualizado: ${nome} (ID: ${id})`);
    
    res.json(vinhoAtualizado[0]);
}));

// DELETE - Deletar vinho (admin only, e imagem do Cloudinary)
router.delete('/:id', verificarAdminAuth, validateId, catchAsync(async (req, res) => {
    const id = req.params.id;

    // Buscar vinho para deletar imagem do Cloudinary
    const [vinho] = await pool.query('SELECT * FROM vinhos WHERE id = ?', [id]);
    
    if (vinho.length === 0) {
        throw new AppError('Vinho não encontrado', 404);
    }

    // Deletar imagem do Cloudinary se existir
    if (vinho[0].imagem && vinho[0].imagem.includes('cloudinary.com')) {
        try {
            const urlParts = vinho[0].imagem.split('/');
            const publicIdWithExt = urlParts[urlParts.length - 1];
            const publicId = `vinhos/${publicIdWithExt.split('.')[0]}`;
            await cloudinary.uploader.destroy(publicId);
        } catch (err) {
            logger.warn('Erro ao deletar imagem do Cloudinary:', err.message);
        }
    }

    await pool.query('DELETE FROM vinhos WHERE id = ?', [id]);
    
    // Invalidar cache
    await cacheService.invalidateVinhosCache();
    logger.info(`Vinho deletado: ${vinho[0].nome} (ID: ${id})`);
    
    res.json({ message: 'Vinho deletado com sucesso' });
}));

// GET - Filtrar vinhos por tipo - COM CACHE
router.get('/tipo/:tipo', cacheService.cacheMiddleware(300), catchAsync(async (req, res) => {
    const [vinhos] = await pool.query(
        'SELECT * FROM vinhos WHERE tipo = ? AND (ativo = TRUE OR ativo IS NULL) ORDER BY created_at DESC',
        [req.params.tipo]
    );
    res.json(vinhos);
}));

module.exports = router;
