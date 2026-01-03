-- Migration: adicionar pais de origem e bandeira aos vinhos (sem perda de dados)
-- Execute no Railway ou cliente MySQL conectado ao banco de producao

USE catalogo_vinhos;

-- Adiciona pais de origem (nome amigavel), codigo ISO2 e URL da bandeira
ALTER TABLE vinhos
    ADD COLUMN IF NOT EXISTS pais_origem VARCHAR(100) NULL AFTER uva,
    ADD COLUMN IF NOT EXISTS pais_codigo CHAR(2) NULL AFTER pais_origem,
    ADD COLUMN IF NOT EXISTS bandeira_url VARCHAR(500) NULL AFTER pais_codigo;

-- Indice auxiliar para buscas por pais
CREATE INDEX IF NOT EXISTS idx_vinhos_pais ON vinhos (pais_origem, pais_codigo);

-- Observacao: valores existentes permanecem intocados; novos campos iniciam como NULL.
