-- Criação do Banco de Dados
CREATE DATABASE IF NOT EXISTS catalogo_vinhos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE catalogo_vinhos;

-- Tabela de Vinhos
CREATE TABLE IF NOT EXISTS vinhos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo ENUM('tinto', 'branco', 'rose', 'espumante') NOT NULL,
    uva VARCHAR(255) NOT NULL,
    ano INT NOT NULL,
    guarda VARCHAR(100),
    harmonizacao TEXT,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    imagem VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Configurações
CREATE TABLE IF NOT EXISTS configuracoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir dados iniciais de vinhos
INSERT INTO vinhos (nome, tipo, uva, ano, guarda, harmonizacao, descricao, preco, imagem) VALUES
('Château Margaux', 'tinto', 'Cabernet Sauvignon', 2015, '10 a 20 anos', 'Carnes vermelhas, cordeiro, queijos maturados', 'Um vinho elegante e complexo, com notas de frutas negras, especiarias e taninos sedosos.', 450.00, 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=500'),
('Domaine Leflaive', 'branco', 'Chardonnay', 2018, '5 a 10 anos', 'Peixes, frutos do mar, aves', 'Vinho branco refinado com aromas cítricos, notas minerais e final persistente.', 320.00, 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=500'),
('Château d''Esclans', 'rose', 'Grenache', 2020, '2 a 5 anos', 'Saladas, pratos leves, queijos suaves', 'Rosé delicado com aromas florais, frutas vermelhas frescas e excelente acidez.', 180.00, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500');

-- Inserir configurações padrão
INSERT INTO configuracoes (chave, valor) VALUES
('telefone', '(54) 99999-9999'),
('email', 'contato@davinivinhos.com.br'),
('endereco', 'Jolimont, RS'),
('instagram', 'https://instagram.com'),
('facebook', 'https://facebook.com'),
('whatsapp', '5554999999999');

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir usuário administrador
INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) VALUES
('Hygor David Araujo', '(62)98183-1483', 'hygordavidaraujo@gmail.com', '79461382', TRUE);
