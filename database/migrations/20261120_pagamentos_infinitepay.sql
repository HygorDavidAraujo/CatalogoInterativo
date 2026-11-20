-- Execute no SQL Editor do Neon antes de publicar a integração.
BEGIN;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS frete NUMERIC(10,2) CHECK (frete >= 0);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entrega_tipo VARCHAR(20) CHECK (entrega_tipo IN ('entrega', 'retirada'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entrega_detalhes VARCHAR(1000);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS origem VARCHAR(20) NOT NULL DEFAULT 'catalogo';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vendedor_id INTEGER REFERENCES usuarios(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS chave_criacao UUID UNIQUE;

-- Uma cobrança por pedido: reenvios reutilizam a mesma identidade e o mesmo payload.
-- Alterações de entrega ficam bloqueadas após iniciar a cobrança.
CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID PRIMARY KEY,
    pedido_id INTEGER NOT NULL UNIQUE REFERENCES pedidos(id),
    metodo VARCHAR(20) NOT NULL CHECK (metodo IN ('checkout', 'tap')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('gerando', 'pendente', 'pago')),
    valor_centavos BIGINT NOT NULL CHECK (valor_centavos >= 100),
    payload JSONB NOT NULL,
    checkout_url TEXT,
    slug VARCHAR(255),
    transaction_nsu VARCHAR(255) UNIQUE,
    confirmacao VARCHAR(30) CHECK (confirmacao IN ('api', 'manual_admin')),
    confirmado_por INTEGER REFERENCES usuarios(id),
    pago_em TIMESTAMPTZ,
    expira_em TIMESTAMPTZ NOT NULL,
    tentativa_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);
COMMIT;
