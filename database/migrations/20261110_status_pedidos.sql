-- Aplicar no SQL Editor do Neon ANTES de publicar a padronização de status.
-- Mantém os pedidos existentes e aceita os nomes antigos durante a transição.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Remove somente checks da coluna status, inclusive se o nome foi personalizado.
DO $migration$
DECLARE
    restricao RECORD;
BEGIN
    FOR restricao IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'status'
        WHERE c.conrelid = 'pedidos'::regclass
          AND c.contype = 'c'
          AND c.conkey = ARRAY[a.attnum]
    LOOP
        EXECUTE format('ALTER TABLE pedidos DROP CONSTRAINT %I', restricao.conname);
    END LOOP;
END;
$migration$;

ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN (
    'pendente', 'aguardando_pagamento', 'confirmado', 'em_preparacao',
    'em_rota_entrega', 'finalizado', 'cancelado',
    'processando', 'enviado', 'entregue'
));

COMMIT;
