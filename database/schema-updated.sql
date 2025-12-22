-- Catálogo Interativo de Vinhos - SCHEMA ATUALIZADO
-- IMPORTANTE: Este schema corrige todos os problemas de divergência identificados
-- Última atualização: 2024
-- Mudanças: Adicionado coluna 'ativo' em vinhos, corrigidas colunas de configuracoes

-- Criação do Banco de Dados
CREATE DATABASE IF NOT EXISTS catalogo_vinhos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE catalogo_vinhos;

-- Tabela de Vinhos (ATUALIZADA: Adicionada coluna ativo)
CREATE TABLE IF NOT EXISTS vinhos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo ENUM('tinto', 'branco', 'rose', 'espumante', 'suco_integral_tinto', 'suco_integral_branco') NOT NULL,
    uva VARCHAR(255) NOT NULL,
    ano INT NOT NULL,
    guarda VARCHAR(100),
    harmonizacao TEXT,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    imagem VARCHAR(500),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ativo (ativo),
    INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Configurações (ATUALIZADA: Corrigidas para usar colunas específicas)
CREATE TABLE IF NOT EXISTS configuracoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_site VARCHAR(255),
    titulo VARCHAR(255),
    descricao TEXT,
    telefone VARCHAR(20),
    email VARCHAR(255),
    endereco TEXT,
    whatsapp VARCHAR(20),
    instagram VARCHAR(500),
    facebook VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Usuários (ATUALIZADA: Adicionados campos de endereço)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    cpf VARCHAR(14) UNIQUE,
    logradouro VARCHAR(255),
    numero VARCHAR(10),
    complemento VARCHAR(255),
    bairro VARCHAR(100),
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_cpf (cpf),
    INDEX idx_admin (is_admin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status ENUM('pendente', 'processando', 'enviado', 'entregue', 'cancelado') DEFAULT 'pendente',
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Itens do Pedido
CREATE TABLE IF NOT EXISTS pedidos_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    vinho_id INT NOT NULL,
    vinho_nome VARCHAR(255) NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    INDEX idx_pedido_id (pedido_id),
    INDEX idx_vinho_id (vinho_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== DADOS INICIAIS =====

-- Limpar dados anteriores (usar com cuidado em produção!)
-- DELETE FROM vinhos;
-- DELETE FROM configuracoes;
-- DELETE FROM usuarios;
-- DELETE FROM pedidos;

-- Inserir configurações padrão (ATUALIZADA: Usar nova estrutura de colunas)
INSERT INTO configuracoes (nome_site, titulo, descricao, telefone, email, endereco, whatsapp, instagram, facebook) VALUES
('Davini Vinhos', 'Catálogo Interativo de Vinhos', 'Explore nossa seleção premium de vinhos', '(54) 3299-1234', 'contato@davinivinhos.com.br', 'Jolimont, RS', '5554999999999', 'https://instagram.com/davinivinhos', 'https://facebook.com/davinivinhos')
ON DUPLICATE KEY UPDATE
    titulo = VALUES(titulo),
    descricao = VALUES(descricao),
    telefone = VALUES(telefone),
    email = VALUES(email),
    endereco = VALUES(endereco),
    whatsapp = VALUES(whatsapp),
    instagram = VALUES(instagram),
    facebook = VALUES(facebook);

-- Inserir vinhos iniciais
INSERT INTO vinhos (nome, tipo, uva, ano, guarda, harmonizacao, descricao, preco, imagem, ativo) VALUES
('Château Margaux', 'tinto', 'Cabernet Sauvignon', 2015, '10 a 20 anos', 'Carnes vermelhas, cordeiro, queijos maturados', 'Um vinho elegante e complexo, com notas de frutas negras, especiarias e taninos sedosos.', 450.00, 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=500', TRUE),
('Domaine Leflaive', 'branco', 'Chardonnay', 2018, '5 a 10 anos', 'Peixes, frutos do mar, aves', 'Vinho branco refinado com aromas cítricos, notas minerais e final persistente.', 320.00, 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=500', TRUE),
('Château d''Esclans', 'rose', 'Grenache', 2020, '2 a 5 anos', 'Saladas, pratos leves, queijos suaves', 'Rosé delicado com aromas florais, frutas vermelhas frescas e excelente acidez.', 180.00, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500', TRUE)
ON DUPLICATE KEY UPDATE
    ativo = VALUES(ativo);

-- Inserir usuário administrador (IMPORTANTE: ALTERAR SENHA PADRÃO EM PRODUÇÃO!)
-- A senha aqui é um placeholder e deve ser alterada para uma senha bcrypt forte
INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin, cpf, logradouro, numero, bairro, cep, cidade, estado) VALUES
('Hygor David Araujo', '(62)98183-1483', 'hygordavidaraujo@gmail.com', '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr', TRUE, '123.456.789-00', 'Rua Exemplo', '123', 'Centro', '12345-678', 'Jolimont', 'RS')
ON DUPLICATE KEY UPDATE
    nome_completo = VALUES(nome_completo),
    telefone = VALUES(telefone),
    is_admin = VALUES(is_admin);

-- ===== ÍNDICES ADICIONAIS PARA PERFORMANCE =====
ALTER TABLE vinhos ADD INDEX IF NOT EXISTS idx_preco (preco);
ALTER TABLE vinhos ADD INDEX IF NOT EXISTS idx_ano (ano);

-- ===== FIM DO SCHEMA =====
