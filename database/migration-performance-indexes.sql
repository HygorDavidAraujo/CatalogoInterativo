-- ===== MIGRATION: ÍNDICES DE PERFORMANCE =====
-- Criado em: 2026-01-24
-- Descrição: Adiciona índices otimizados para melhorar performance das queries
-- NOTA: Se o índice já existir, o comando falhará mas não afetará o banco

-- Índices para tabela VINHOS
CREATE INDEX idx_vinhos_tipo ON vinhos(tipo);
CREATE INDEX idx_vinhos_ativo ON vinhos(ativo);
CREATE INDEX idx_vinhos_nome ON vinhos(nome);
CREATE INDEX idx_vinhos_preco ON vinhos(preco);
CREATE INDEX idx_vinhos_tipo_ativo ON vinhos(tipo, ativo);
CREATE INDEX idx_vinhos_created_at ON vinhos(created_at DESC);

-- Índices para tabela USUARIOS
CREATE INDEX idx_usuarios_is_admin ON usuarios(is_admin);
CREATE INDEX idx_usuarios_is_vip ON usuarios(is_vip);

-- Índices para tabela PEDIDOS
CREATE INDEX idx_pedidos_usuario_id ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_usuario_data ON pedidos(usuario_id, created_at DESC);
CREATE INDEX idx_pedidos_created_at ON pedidos(created_at DESC);

-- Índices para tabela PEDIDOS_ITENS
CREATE INDEX idx_pedidos_itens_pedido ON pedidos_itens(pedido_id);
CREATE INDEX idx_pedidos_itens_vinho ON pedidos_itens(vinho_id);

-- ===== ESTATÍSTICAS =====
ANALYZE TABLE vinhos;
ANALYZE TABLE usuarios;
ANALYZE TABLE pedidos;
ANALYZE TABLE pedidos_itens;
ANALYZE TABLE configuracoes;
