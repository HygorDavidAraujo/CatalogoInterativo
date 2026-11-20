-- Permite substituir tentativas presenciais sem apagar o histórico.
BEGIN;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS substituida_em TIMESTAMPTZ;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS substituida_por INTEGER REFERENCES usuarios(id);
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_pedido_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_pedido_ativo ON pagamentos(pedido_id) WHERE ativa = TRUE;
CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido_historico ON pagamentos(pedido_id, created_at DESC);
COMMIT;
