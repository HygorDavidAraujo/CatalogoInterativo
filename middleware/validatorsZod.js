// ===== ZOD VALIDATORS =====
const { z } = require('zod');

// ===== SCHEMAS =====

// Schema para login
const loginSchema = z.object({
    email: z.string()
        .email('Email inválido')
        .min(1, 'Email é obrigatório'),
    senha: z.string()
        .min(1, 'Senha é obrigatória')
});

// Schema para cadastro de usuário
const booleanFromString = z.preprocess((value) => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1'].includes(normalized)) return true;
        if (['false', '0'].includes(normalized)) return false;
    }
    return value;
}, z.boolean());

const cadastroSchema = z.object({
    nome_completo: z.string()
        .min(3, 'Nome deve ter no mínimo 3 caracteres')
        .max(200, 'Nome deve ter no máximo 200 caracteres')
        .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
    telefone: z.string()
        .regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, 'Telefone inválido. Use formato (XX)XXXXX-XXXX')
        .optional(),
    email: z.string()
        .email('Email inválido')
        .min(1, 'Email é obrigatório'),
    senha: z.string()
        .min(6, 'Senha deve ter no mínimo 6 caracteres')
        .max(100, 'Senha deve ter no máximo 100 caracteres'),
    cpf: z.string()
        .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido. Use formato XXX.XXX.XXX-XX')
        .optional()
});

// Schema para vinho
const tiposPermitidos = ['tinto', 'branco', 'rose', 'espumante', 'suco_integral_tinto', 'suco_integral_branco'];
const decimalSchema = z.union([
    z.number(),
    z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'Informe um número com até duas casas decimais')
]).pipe(z.coerce.number().finite().nonnegative())
    .refine(value => value === Number(value.toFixed(2)),
        'Informe um número com até duas casas decimais')
    .transform(value => Math.round(value * 100) / 100);

const anoSchema = z.union([z.number(), z.string().trim().regex(/^\d{4}$/, 'Informe uma safra válida')])
    .pipe(z.coerce.number().int('Ano deve ser um número inteiro')
        .min(1900, 'Ano deve ser maior ou igual a 1900')
        .max(new Date().getFullYear() + 1, 'Ano inválido'));

const urlImagemSchema = z.string().trim().max(500, 'URL deve ter no máximo 500 caracteres')
    .refine(value => {
        if (value === '') return true;
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
        } catch (_) {
            return false;
        }
    }, 'Informe uma URL de imagem válida com http ou https');

const vinhoSchema = z.object({
    nome: z.string().trim()
        .min(3, 'Nome deve ter no mínimo 3 caracteres')
        .max(200, 'Nome deve ter no máximo 200 caracteres'),
    tipo: z.enum(tiposPermitidos, {
        errorMap: () => ({ message: 'Tipo deve ser: tinto, branco, rose, espumante ou suco integral' })
    }),
    uva: z.string().trim().min(2, 'Tipo de uva deve ter no mínimo 2 caracteres')
        .max(255, 'Tipo de uva deve ter no máximo 255 caracteres'),
    ano: anoSchema,
    preco: decimalSchema.refine(value => value > 0 && value <= 999999.99, 'Preço deve estar entre 0,01 e 999999,99'),
    descricao: z.string()
        .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
        .optional(),
    harmonizacao: z.string()
        .max(1000, 'Harmonização deve ter no máximo 1000 caracteres')
        .optional(),
    guarda: z.string()
        .max(100, 'Guarda deve ter no máximo 100 caracteres')
        .optional(),
    ativo: booleanFromString
        .optional()
        .default(true),
    pais_origem: z.string()
        .max(100, 'País de origem deve ter no máximo 100 caracteres')
        .optional(),
    pais_codigo: z.string().trim()
        .regex(/^([a-zA-Z]{2})?$/, 'Código do país deve ter duas letras')
        .transform(value => value.toUpperCase()).optional(),
    bandeira_url: urlImagemSchema.optional(),
    imagemUrl: urlImagemSchema.optional()
}).strict();

// Schema para vinho parcial (update)
const vinhoUpdateSchema = vinhoSchema.extend({
    removerImagem: booleanFromString.optional(),
    ativo: booleanFromString.optional()
}).partial().refine(value => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar');

// Schema para ID
const idSchema = z.object({
    id: z.string()
        .regex(/^\d+$/, 'ID deve ser um número válido')
        .transform(Number)
        .pipe(z.number().int().min(1).max(2147483647))
});

const inteiroQuery = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(2147483647));
const vinhosQuerySchema = z.object({
    page: inteiroQuery.optional().default(1),
    limit: inteiroQuery.pipe(z.number().max(100)).optional().default(50),
    admin: z.enum(['true', 'false']).optional().default('false').transform(value => value === 'true'),
    orderBy: z.enum(['created_at', 'nome', 'preco', 'ano']).optional().default('created_at'),
    order: z.string().transform(value => value.toUpperCase()).pipe(z.enum(['ASC', 'DESC'])).optional().default('DESC')
}).strict();
const vinhoDetalheQuerySchema = z.object({
    admin: z.enum(['true', 'false']).optional().default('false').transform(value => value === 'true')
}).strict();
const vinhoTipoSchema = z.object({ tipo: z.enum([...tiposPermitidos, 'suco_integral']) });

const beneficioSchema = z.object({
    nome: z.string().trim().min(1).max(255),
    slug: z.string().trim().regex(/^[a-z0-9_-]+$/).max(255),
    tipo_desconto: z.enum(['percentual', 'valor_fixo']),
    valor_desconto: decimalSchema.refine(value => value <= 99999999.99, 'Desconto excede o limite permitido'),
    cor: z.string().regex(/^#[a-f\d]{6}$/i).optional(),
    ordem: z.number().int().min(0).max(2147483647).optional().default(0)
}).strict().refine(value => value.tipo_desconto !== 'percentual' || value.valor_desconto <= 100,
    { path: ['valor_desconto'], message: 'Desconto percentual deve estar entre 0 e 100' });

// Schema para configurações
const configuracoesSchema = z.object({
    nome_site: z.string()
        .max(200, 'Nome do site deve ter no máximo 200 caracteres')
        .optional(),
    titulo: z.string()
        .max(200, 'Título deve ter no máximo 200 caracteres')
        .optional(),
    descricao: z.string()
        .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
        .optional(),
    telefone: z.string()
        .max(20, 'Telefone deve ter no máximo 20 caracteres')
        .optional(),
    email: z.string()
        .email('Email inválido')
        .optional(),
    endereco: z.string()
        .max(500, 'Endereço deve ter no máximo 500 caracteres')
        .optional(),
    whatsapp: z.string()
        .max(20, 'WhatsApp deve ter no máximo 20 caracteres')
        .optional(),
    instagram: z.string()
        .url('URL do Instagram inválida')
        .optional()
        .or(z.literal('')),
    facebook: z.string()
        .url('URL do Facebook inválida')
        .optional()
        .or(z.literal(''))
});

// Schema para pedido
const pedidoSchema = z.object({
    itens: z.array(
        z.object({
            vinho_id: z.number().int().positive(),
            vinho_nome: z.string().min(1),
            quantidade: z.number().int().positive('Quantidade deve ser maior que zero'),
            preco_unitario: z.number().positive('Preço deve ser positivo')
        })
    ).min(1, 'Pedido deve ter pelo menos um item'),
    observacoes: z.string()
        .max(1000, 'Observações devem ter no máximo 1000 caracteres')
        .optional()
});

// ===== MIDDLEWARE DE VALIDAÇÃO =====

/**
 * Factory para criar middleware de validação Zod
 * @param {z.ZodSchema} schema - Schema Zod para validação
 * @param {string} source - Origem dos dados: 'body', 'params', 'query'
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const data = req[source];
            const validatedData = schema.parse(data);
            
            // Substituir dados originais pelos validados e transformados
            req[source] = validatedData;
            
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issues = Array.isArray(error.issues)
                    ? error.issues
                    : Array.isArray(error.errors)
                        ? error.errors
                        : [];

                let errors = [{ field: '', message: error.message || 'Dados inválidos' }];

                if (Array.isArray(issues) && issues.length > 0) {
                    errors = issues.map(err => ({
                        field: Array.isArray(err?.path) ? err.path.join('.') : '',
                        message: err?.message || 'Dados inválidos'
                    }));
                }
                
                return res.status(400).json({
                    status: 'error',
                    message: 'Dados inválidos',
                    errors
                });
            }
            
            next(error);
        }
    };
};

// ===== EXPORTS =====
module.exports = {
    // Schemas
    loginSchema,
    cadastroSchema,
    vinhoSchema,
    vinhoUpdateSchema,
    vinhosQuerySchema,
    beneficioSchema,
    idSchema,
    configuracoesSchema,
    pedidoSchema,
    
    // Middleware factory
    validate,
    
    // Validators prontos para uso
    validateLogin: validate(loginSchema, 'body'),
    validateCadastro: validate(cadastroSchema, 'body'),
    validateVinho: validate(vinhoSchema, 'body'),
    validateVinhoUpdate: validate(vinhoUpdateSchema, 'body'),
    validateId: validate(idSchema, 'params'),
    validateVinhosQuery: validate(vinhosQuerySchema, 'query'),
    validateVinhoDetalheQuery: validate(vinhoDetalheQuerySchema, 'query'),
    validateVinhoTipo: validate(vinhoTipoSchema, 'params'),
    validateBeneficio: validate(beneficioSchema, 'body'),
    validateConfiguracoes: validate(configuracoesSchema, 'body'),
    validatePedido: validate(pedidoSchema, 'body')
};
