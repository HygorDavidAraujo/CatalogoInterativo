-- ============================================
-- MIGRAÇÃO: Criar tabela pedidos_itens
-- Data: 2025-12-22
-- Descrição: Adiciona tabela pedidos_itens para normalizar estrutura
-- ============================================

USE catalogo_vinhos;

-- 1. Criar tabela pedidos_itens se não existir
CREATE TABLE IF NOT EXISTS pedidos_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    vinho_id INT NOT NULL,
    vinho_nome VARCHAR(255) NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    INDEX idx_pedido_id (pedido_id),
    INDEX idx_vinho_id (vinho_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Verificar estrutura
SHOW CREATE TABLE pedidos_itens;

-- 3. Verificar dados (deve estar vazia inicialmente)
SELECT COUNT(*) as total_itens FROM pedidos_itens;

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
