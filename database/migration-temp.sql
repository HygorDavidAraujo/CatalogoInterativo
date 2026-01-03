ALTER TABLE vinhos
    ADD COLUMN IF NOT EXISTS pais_origem VARCHAR(100) NULL AFTER uva,
    ADD COLUMN IF NOT EXISTS pais_codigo CHAR(2) NULL AFTER pais_origem,
    ADD COLUMN IF NOT EXISTS bandeira_url VARCHAR(500) NULL AFTER pais_codigo;

CREATE INDEX IF NOT EXISTS idx_vinhos_pais ON vinhos (pais_origem, pais_codigo);
