-- Aplicar no SQL Editor do Neon ANTES de publicar esta versão do backend.
-- Migração aditiva: pode ser aplicada enquanto a versão anterior está em uso.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS sessoes_usuario (
    id UUID PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_em TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id ON sessoes_usuario (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes_usuario (expira_em);

CREATE OR REPLACE FUNCTION revogar_sessoes_usuario()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM sessoes_usuario WHERE usuario_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS usuarios_revogar_sessoes ON usuarios;
CREATE TRIGGER usuarios_revogar_sessoes
AFTER UPDATE OF senha, is_admin ON usuarios
FOR EACH ROW
WHEN (OLD.senha IS DISTINCT FROM NEW.senha OR OLD.is_admin IS DISTINCT FROM NEW.is_admin)
EXECUTE FUNCTION revogar_sessoes_usuario();

COMMIT;
