const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { upload, cloudinary } = require('../config/cloudinary');
const { verificarAdminAuth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { validateVinho, validateVinhoUpdate, validateId, validateVinhosQuery, validateVinhoDetalheQuery, validateVinhoTipo, fichaTecnicaSchema } = require('../middleware/validatorsZod');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const cacheService = require('../services/cacheService');
const logger = require('../config/logger');

// Autorizar antes de consultar/cachear. O parâmetro de URL nunca concede permissão.
function autorizarConsulta(req, res, next) {
    if (req.query.admin) {
        res.set('Cache-Control', 'private, no-store');
        return verificarAdminAuth(req, res, next);
    }
    next();
}

// Não reutilizar entradas antigas que podiam conter produtos ocultos.
const cacheListaPublica = cacheService.cacheMiddleware(300, req => `cache:/api/vinhos:v3:${req.originalUrl}`);
function cacheConsultaPublica(req, res, next) {
    if (req.query.admin) return next();
    return cacheListaPublica(req, res, next);
}

// GET - Listar vinhos; modo administrativo autenticado e sem cache compartilhado.
router.get('/', validateVinhosQuery, autorizarConsulta, cacheConsultaPublica, catchAsync(async (req, res) => {
    const mostrarInativos = req.query.admin;
    const { page, limit, orderBy: safeOrderBy, order: safeOrder } = req.query;
    const offset = (page - 1) * limit;
    
    // Query base
    let whereClause = '';
    if (!mostrarInativos) {
        whereClause = ' WHERE (ativo = TRUE OR ativo IS NULL)';
    }
    
    // Contar total
    const countQuery = `SELECT COUNT(*) as total FROM vinhos${whereClause}`;
    const countResult = await pool.query(countQuery);
    const total = Number(countResult.rows[0].total);
    
    // Buscar vinhos com paginação
    const query = `SELECT * FROM vinhos${whereClause} ORDER BY ${safeOrderBy} ${safeOrder} LIMIT $1 OFFSET $2`;
    const { rows: vinhos } = await pool.query(query, [limit, offset]);
    
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

// GET - Consultar visibilidade vigente no banco; não servir detalhes ocultos do cache.
router.get('/:id', validateId, validateVinhoDetalheQuery, autorizarConsulta, catchAsync(async (req, res) => {
    const whereAtivo = req.query.admin ? '' : ' AND (ativo = TRUE OR ativo IS NULL)';
    const { rows: vinhos } = await pool.query(`SELECT * FROM vinhos WHERE id = $1${whereAtivo}`, [req.params.id]);
    
    if (vinhos.length === 0) {
        throw new AppError('Vinho não encontrado', 404);
    }
    
    res.json(vinhos[0]);
}));

// POST - Criar novo vinho (admin only, com upload de imagem no Cloudinary)
router.post('/', verificarAdminAuth, uploadLimiter, upload.single('imagem'), validateVinho, catchAsync(async (req, res) => {
    req.etapaOperacao = 'cadastrar-vinho';
    const { nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagemUrl, ativo } = req.body;

    // Usar imagem do Cloudinary, URL fornecida ou vazio
    let imagemPath = imagemUrl || '';
    if (req.file) {
        imagemPath = req.file.path;
    }

    // Converter ativo para boolean
    const ativoBoolean = ativo === 'true' || ativo === true || ativo === '1';

    const result = await pool.query(
        'INSERT INTO vinhos (nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagem, ativo, ficha_tecnica) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb) RETURNING id',
        [nome, tipo, uva, pais_origem || null, pais_codigo || null, bandeira_url || null, ano, guarda || '', harmonizacao || '', descricao || '', preco, imagemPath, ativoBoolean, JSON.stringify(req.body.ficha_tecnica || {})]
    );

    const id = result.rows[0].id;
    const { rows: novoVinho } = await pool.query('SELECT * FROM vinhos WHERE id = $1', [id]);
    
    // Invalidar cache de vinhos
    await cacheService.invalidateVinhosCache();
    logger.info(`Vinho criado: ${nome} (ID: ${id})`);
    
    res.status(201).json(novoVinho[0]);
}));

// PUT - Atualizar vinho (admin only, com upload no Cloudinary)
router.put('/:id', verificarAdminAuth, uploadLimiter, validateId, upload.single('imagem'), validateVinhoUpdate, catchAsync(async (req, res) => {
    req.etapaOperacao = 'atualizar-vinho';
    const { nome, tipo, uva, pais_origem, pais_codigo, bandeira_url, ano, guarda, harmonizacao, descricao, preco, imagemUrl, ativo, removerImagem } = req.body;
    const id = req.params.id;

    // Buscar vinho atual
    const { rows: vinhoAtual } = await pool.query('SELECT * FROM vinhos WHERE id = $1', [id]);
    
    if (vinhoAtual.length === 0) {
        throw new AppError('Vinho não encontrado', 404);
    }
    const fichaCombinada = fichaTecnicaSchema.safeParse({ ...vinhoAtual[0].ficha_tecnica, ...req.body.ficha_tecnica });
    if (!fichaCombinada.success) {
        return res.status(400).json({ message: 'Revise a ficha técnica', errors: fichaCombinada.error.issues.map(issue => ({
            field: `ficha_tecnica.${issue.path.join('.')}`, message: issue.message
        })) });
    }

    const deveRemoverImagem = removerImagem === true || removerImagem === 'true' || removerImagem === '1';

    // Determinar qual imagem usar
    let imagemPath = vinhoAtual[0].imagem;

    // Remoção explícita da imagem atual
    if (deveRemoverImagem && vinhoAtual[0].imagem && vinhoAtual[0].imagem.includes('cloudinary.com')) {
        try {
            const urlParts = vinhoAtual[0].imagem.split('/');
            const publicIdWithExt = urlParts[urlParts.length - 1];
            const publicId = `vinhos/${publicIdWithExt.split('.')[0]}`;
            await cloudinary.uploader.destroy(publicId);
        } catch (err) {
            logger.warn('Erro ao deletar imagem antiga do Cloudinary:', err.message);
        }
    }

    if (deveRemoverImagem) {
        imagemPath = null; // guardar NULL no banco quando remover
    }

    if (req.file) {
        imagemPath = req.file.path;
        
        // Deletar imagem antiga do Cloudinary se existir e ainda não removida
        if (!deveRemoverImagem && vinhoAtual[0].imagem && vinhoAtual[0].imagem.includes('cloudinary.com')) {
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
        'UPDATE vinhos SET nome = $1, tipo = $2, uva = $3, pais_origem = $4, pais_codigo = $5, bandeira_url = $6, ano = $7, guarda = $8, harmonizacao = $9, descricao = $10, preco = $11, imagem = $12, ativo = $13, ficha_tecnica = COALESCE(ficha_tecnica, \'{}\'::jsonb) || $14::jsonb WHERE id = $15',
        [
            nome ?? vinhoAtual[0].nome,
            tipo ?? vinhoAtual[0].tipo,
            uva ?? vinhoAtual[0].uva,
            pais_origem !== undefined ? pais_origem : vinhoAtual[0].pais_origem,
            pais_codigo !== undefined ? pais_codigo : vinhoAtual[0].pais_codigo,
            bandeira_url !== undefined ? bandeira_url : vinhoAtual[0].bandeira_url,
            ano !== undefined ? ano : vinhoAtual[0].ano,
            guarda !== undefined ? guarda : vinhoAtual[0].guarda,
            harmonizacao !== undefined ? harmonizacao : vinhoAtual[0].harmonizacao,
            descricao !== undefined ? descricao : vinhoAtual[0].descricao,
            preco !== undefined ? preco : vinhoAtual[0].preco,
            imagemPath !== undefined ? imagemPath : vinhoAtual[0].imagem,
            ativoBoolean,
            JSON.stringify(req.body.ficha_tecnica || {}),
            id
        ]
    );

    const { rows: vinhoAtualizado } = await pool.query('SELECT * FROM vinhos WHERE id = $1', [id]);
    
    // Invalidar cache
    await cacheService.invalidateVinhosCache();
    logger.info(`Vinho atualizado: ${nome} (ID: ${id})`);
    
    res.json(vinhoAtualizado[0]);
}));

// DELETE - Deletar vinho (admin only, e imagem do Cloudinary)
router.delete('/:id', verificarAdminAuth, validateId, catchAsync(async (req, res) => {
    const id = req.params.id;

    // Buscar vinho para deletar imagem do Cloudinary
    const { rows: vinho } = await pool.query('SELECT * FROM vinhos WHERE id = $1', [id]);
    
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

    await pool.query('DELETE FROM vinhos WHERE id = $1', [id]);
    
    // Invalidar cache
    await cacheService.invalidateVinhosCache();
    logger.info(`Vinho deletado: ${vinho[0].nome} (ID: ${id})`);
    
    res.json({ message: 'Vinho deletado com sucesso' });
}));

// GET - Filtrar vinhos por tipo - COM CACHE
router.get('/tipo/:tipo', validateVinhoTipo, validateVinhoDetalheQuery, autorizarConsulta, cacheConsultaPublica, catchAsync(async (req, res) => {
    const tipos = req.params.tipo === 'suco_integral'
        ? ['suco_integral_tinto', 'suco_integral_branco'] : [req.params.tipo];
    const { rows: vinhos } = await pool.query(
        'SELECT * FROM vinhos WHERE tipo = ANY($1::text[]) AND (ativo = TRUE OR ativo IS NULL) ORDER BY created_at DESC',
        [tipos]
    );
    res.json(vinhos);
}));

module.exports = router;
