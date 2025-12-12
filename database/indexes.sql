-- Índices para melhorar performance

-- Índice para busca por nome de vinho
CREATE INDEX IF NOT EXISTS idx_vinhos_nome ON vinhos(nome);

-- Índice para busca por tipo de uva
CREATE INDEX IF NOT EXISTS idx_vinhos_uva ON vinhos(uva);

-- Índice para filtro por tipo
CREATE INDEX IF NOT EXISTS idx_vinhos_tipo ON vinhos(tipo);

-- Índice composto para filtros e ordenação
CREATE INDEX IF NOT EXISTS idx_vinhos_ativo_created ON vinhos(ativo, created_at DESC);

-- Índice para busca por email em usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Índice para relacionamento de pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON pedidos(usuario_id);

-- Índice para status de pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);

-- Índice para itens de pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_itens_pedido ON pedidos_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_itens_vinho ON pedidos_itens(vinho_id);
