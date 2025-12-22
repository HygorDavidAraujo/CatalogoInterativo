const { body, param, validationResult } = require('express-validator');

// Middleware para processar erros de validação
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Dados inválidos', 
            details: errors.array().map(err => ({ field: err.path, message: err.msg }))
        });
    }
    next();
};

// Validações para login
const validateLogin = [
    body('email')
        .trim()
        .isEmail().withMessage('Email inválido')
        .normalizeEmail(),
    body('senha')
        .exists().withMessage('Senha é obrigatória')
        .isLength({ min: 1 }).withMessage('Senha não pode estar vazia'),
    handleValidationErrors
];

// Validações para cadastro
const validateCadastro = [
    body('nome_completo')
        .trim()
        .isLength({ min: 3, max: 255 }).withMessage('Nome deve ter entre 3 e 255 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s]+$/).withMessage('Nome deve conter apenas letras e espaços'),
    body('telefone')
        .trim()
        .matches(/^\(\d{2}\)\d{4,5}-\d{4}$/).withMessage('Telefone deve estar no formato (XX)XXXXX-XXXX'),
    body('email')
        .trim()
        .isEmail().withMessage('Email inválido')
        .normalizeEmail(),
    body('senha')
        .isLength({ min: 6, max: 100 }).withMessage('Senha deve ter entre 6 e 100 caracteres')
        .matches(/^(?=.*[a-z])/).withMessage('Senha deve conter pelo menos uma letra minúscula'),
    handleValidationErrors
];

// Validações para vinho
const validateVinho = [
    body('nome')
        .trim()
        .isLength({ min: 3, max: 255 }).withMessage('Nome deve ter entre 3 e 255 caracteres'),
    body('tipo')
        .isIn(['tinto', 'branco', 'rose', 'espumante', 'suco_integral_tinto', 'suco_integral_branco'])
        .withMessage('Tipo inválido'),
    body('uva')
        .trim()
        .isLength({ min: 2, max: 255 }).withMessage('Tipo de uva deve ter entre 2 e 255 caracteres'),
    body('ano')
        .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
        .withMessage('Ano inválido'),
    body('preco')
        .isFloat({ min: 0, max: 999999.99 }).withMessage('Preço deve estar entre 0 e 999999.99')
        .toFloat(),
    body('ativo')
        .optional()
        .isBoolean().withMessage('Ativo deve ser true ou false'),
    handleValidationErrors
];

// Validações para pedido
const validatePedido = [
    body('usuario_id')
        .isInt({ min: 1 }).withMessage('ID do usuário inválido')
        .toInt(),
    body('total')
        .isFloat({ min: 0 }).withMessage('Total deve ser maior ou igual a 0')
        .toFloat(),
    body('itens')
        .isArray({ min: 1 }).withMessage('Pedido deve ter pelo menos 1 item'),
    body('itens.*.id')
        .isInt({ min: 1 }).withMessage('ID do vinho inválido'),
    body('itens.*.nome')
        .trim()
        .isLength({ min: 1 }).withMessage('Nome do vinho é obrigatório'),
    body('itens.*.quantidade')
        .isInt({ min: 1, max: 999 }).withMessage('Quantidade deve estar entre 1 e 999'),
    body('itens.*.preco')
        .isFloat({ min: 0 }).withMessage('Preço inválido'),
    body('observacoes')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Observações não podem exceder 1000 caracteres'),
    handleValidationErrors
];

// Validação para status de pedido
const validatePedidoStatus = [
    body('status')
        .isIn(['pendente', 'em_preparacao', 'em_rota_entrega', 'aguardando_pagamento', 'finalizado', 'cancelado'])
        .withMessage('Status inválido'),
    handleValidationErrors
];

// Validação para perfil
const validatePerfil = [
    body('usuario_id')
        .isInt({ min: 1 }).withMessage('ID do usuário inválido'),
    body('nome')
        .optional()
        .trim()
        .isLength({ min: 3, max: 255 }).withMessage('Nome deve ter entre 3 e 255 caracteres'),
    body('telefone')
        .optional()
        .trim()
        .matches(/^\(\d{2}\)\d{4,5}-\d{4}$/).withMessage('Telefone inválido'),
    body('cpf')
        .optional()
        .trim()
        .matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).withMessage('CPF deve estar no formato XXX.XXX.XXX-XX'),
    body('cep')
        .optional()
        .trim()
        .matches(/^\d{5}-\d{3}$/).withMessage('CEP deve estar no formato XXXXX-XXX'),
    body('estado')
        .optional()
        .trim()
        .isLength({ min: 2, max: 2 }).withMessage('Estado deve ter 2 caracteres (UF)'),
    handleValidationErrors
];

// Validação para ID em parâmetros
const validateId = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID inválido')
        .toInt(),
    handleValidationErrors
];

// Validação para clienteId em parâmetros
const validateClienteId = [
    param('clienteId')
        .isInt({ min: 1 }).withMessage('ID do cliente inválido')
        .toInt(),
    handleValidationErrors
];

module.exports = {
    validateLogin,
    validateCadastro,
    validateVinho,
    validatePedido,
    validatePedidoStatus,
    validatePerfil,
    validateId,
    validateClienteId,
    handleValidationErrors
};
