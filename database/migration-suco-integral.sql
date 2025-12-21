-- ============================================
-- MIGRAÇÃO: Adicionar Categoria Suco Integral
-- Data: 2025-12-20
-- Descrição: Adiciona tipos suco_integral_tinto e suco_integral_branco ao ENUM tipo
-- ============================================

-- IMPORTANTE: Execute este script no banco de dados do Railway

USE catalogo_vinhos;

-- 1. Verificar estrutura atual
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' 
  AND COLUMN_NAME='tipo'
  AND TABLE_SCHEMA='catalogo_vinhos';

-- 2. Atualizar ENUM adicionando novos tipos
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
    'tinto',
    'branco', 
    'rose',
    'espumante',
    'suco_integral_tinto',
    'suco_integral_branco'
) NOT NULL;

-- 3. Validar que a mudança foi aplicada
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' 
  AND COLUMN_NAME='tipo'
  AND TABLE_SCHEMA='catalogo_vinhos';

-- 4. Verificar produtos existentes (não deve quebrar nada)
SELECT tipo, COUNT(*) as total
FROM vinhos
GROUP BY tipo;

-- 5. OPCIONAL: Inserir produtos de exemplo (remova se não precisar)
-- INSERT INTO vinhos (nome, tipo, uva, ano, guarda, harmonizacao, descricao, preco, ativo) VALUES
-- ('Suco Integral de Uva Tinta', 'suco_integral_tinto', 'Blend de tintas', 2024, '', 'Bebida natural e saudável', 'Suco 100% natural de uva tinta, sem conservantes ou açúcar adicionado', 25.90, TRUE),
-- ('Suco Integral de Uva Branca', 'suco_integral_branco', 'Blend de brancas', 2024, '', 'Bebida refrescante', 'Suco 100% natural de uva branca, puro e refrescante', 24.90, TRUE);

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================

-- ROLLBACK (caso precise reverter):
-- ALTER TABLE vinhos MODIFY COLUMN tipo ENUM('tinto', 'branco', 'rose', 'espumante') NOT NULL;
