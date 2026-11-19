-- Executar no Neon antes do deploy. Migração aditiva e repetível.
-- Preserva produtos, safras existentes, preços e pedidos.
BEGIN;
ALTER TABLE vinhos ADD COLUMN IF NOT EXISTS ficha_tecnica JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE vinhos ALTER COLUMN ano DROP NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vinhos_ficha_tecnica_objeto' AND conrelid = 'vinhos'::regclass) THEN
        ALTER TABLE vinhos ADD CONSTRAINT vinhos_ficha_tecnica_objeto CHECK (jsonb_typeof(ficha_tecnica) = 'object');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vinhos_ficha_temperaturas' AND conrelid = 'vinhos'::regclass) THEN
        ALTER TABLE vinhos ADD CONSTRAINT vinhos_ficha_temperaturas
            CHECK ((ficha_tecnica->>'temperatura_min')::numeric <= (ficha_tecnica->>'temperatura_max')::numeric);
    END IF;
END;
$$;
COMMIT;
