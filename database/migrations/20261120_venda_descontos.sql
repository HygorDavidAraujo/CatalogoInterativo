-- Complementa a migração de pagamentos já publicada. Não altera valores antigos.
BEGIN;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_manual NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (desconto_manual >= 0);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_tipo VARCHAR(20) CHECK (desconto_tipo IN ('valor','percentual'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(10,2) CHECK (desconto_valor >= 0);
COMMIT;
