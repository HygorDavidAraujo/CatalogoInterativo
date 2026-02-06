-- Criar tabela de benefícios VIP
CREATE TABLE IF NOT EXISTS beneficios_vip (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    tipo_desconto ENUM('percentual', 'valor_fixo') NOT NULL DEFAULT 'percentual',
    valor_desconto DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserir benefícios VIP padrão
INSERT INTO beneficios_vip (nome, slug, tipo_desconto, valor_desconto, ordem) VALUES
('VIP Prata', 'prata', 'percentual', 3.00, 1),
('VIP Ouro', 'ouro', 'percentual', 7.00, 2),
('VIP Diamante', 'diamante', 'percentual', 11.00, 3);
