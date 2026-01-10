-- Script para adicionar colunas VIP no Railway
-- Execute este script no console MySQL do Railway

USE catalogo_vinhos;

-- Adicionar coluna is_vip se não existir
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;

-- Adicionar coluna vip_tipo se não existir
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS vip_tipo ENUM('prata', 'ouro', 'diamante') DEFAULT NULL;

-- Verificar se as colunas foram criadas
DESCRIBE usuarios;

-- Opcional: Atualizar algum usuário específico para testar
-- UPDATE usuarios SET is_vip = TRUE, vip_tipo = 'ouro' WHERE email = 'seu-email@example.com';
