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
const tiposPermitidos = ['tinto', 'branco', 'rose', 'espumante', 'suco_integral', 'suco_integral_tinto', 'suco_integral_branco'];

const vinhoSchema = z.object({
    nome: z.string()
        .min(3, 'Nome deve ter no mínimo 3 caracteres')
        .max(200, 'Nome deve ter no máximo 200 caracteres'),
    tipo: z.enum(tiposPermitidos, {
        errorMap: () => ({ message: 'Tipo deve ser: tinto, branco, rose, espumante ou suco integral' })
    }),
    uva: z.string()
        .max(100, 'Tipo de uva deve ter no máximo 100 caracteres')
        .optional(),
    ano: z.coerce.number()
        .int('Ano deve ser um número inteiro')
        .min(1900, 'Ano deve ser maior que 1900')
        .max(new Date().getFullYear() + 1, 'Ano inválido')
        .optional()
        .nullable(),
    preco: z.coerce.number()
        .positive('Preço deve ser um valor positivo')
        .max(999999.99, 'Preço muito alto'),
    descricao: z.string()
        .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
        .optional(),
    harmonizacao: z.string()
        .max(1000, 'Harmonização deve ter no máximo 1000 caracteres')
        .optional(),
    guarda: z.string()
        .max(100, 'Guarda deve ter no máximo 100 caracteres')
        .optional(),
    estoque: z.coerce.number()
        .int('Estoque deve ser um número inteiro')
        .min(0, 'Estoque não pode ser negativo')
        .optional()
        .nullable(),
    ativo: booleanFromString
        .optional()
        .default(true),
    pais_origem: z.string()
        .max(100, 'País de origem deve ter no máximo 100 caracteres')
        .optional()
});

// Schema para vinho parcial (update)
const vinhoUpdateSchema = vinhoSchema.extend({
    removerImagem: booleanFromString.optional(),
    ativo: booleanFromString.optional(),
    ano: z.coerce.number().optional().nullable(),
    preco: z.coerce.number().optional(),
    estoque: z.coerce.number().optional().nullable()
}).partial();

// Schema para ID
const idSchema = z.object({
    id: z.string()
        .regex(/^\d+$/, 'ID deve ser um número válido')
        .transform(Number)
});

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
    validateConfiguracoes: validate(configuracoesSchema, 'body'),
    validatePedido: validate(pedidoSchema, 'body')
};
