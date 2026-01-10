-- ============================================
-- SCRIPT DE SETUP DO ADMIN - COPIE E COLE NO DBEAVER
-- ============================================

-- PASSO 1: Limpar admin antigo (se existir com senha ruim)
DELETE FROM usuarios WHERE email = 'hygordavidaraujo@gmail.com' AND NOT senha LIKE '$2%';

-- PASSO 2: Inserir ou atualizar admin com senha bcrypt correta
-- Senha: 123456
-- Hash: $2b$10$YKUaPPO67xfocTzeHRjvfeMjVL1VE1rZ9wiQgheauM9qPx2OW2p/q
INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin, cpf, logradouro, numero, bairro, cep, cidade, estado) 
VALUES (
    'Hygor David Araujo',
    '(62)98183-1483',
    'hygordavidaraujo@gmail.com',
    '$2b$10$YKUaPPO67xfocTzeHRjvfeMjVL1VE1rZ9wiQgheauM9qPx2OW2p/q',
    TRUE,
    '123.456.789-00',
    'Rua Exemplo',
    '123',
    'Centro',
    '12345-678',
    'Jolimont',
    'RS'
)
ON DUPLICATE KEY UPDATE 
    senha = '$2b$10$YKUaPPO67xfocTzeHRjvfeMjVL1VE1rZ9wiQgheauM9qPx2OW2p/q',
    is_admin = TRUE,
    nome_completo = 'Hygor David Araujo',
    telefone = '(62)98183-1483';

-- PASSO 3: Verificar se funcionou
SELECT 
    id,
    email,
    nome_completo,
    is_admin,
    LEFT(senha, 30) as senha_inicio,
    CASE 
        WHEN senha LIKE '$2%' THEN '✅ BCRYPT'
        ELSE '❌ NÃO BCRYPT'
    END as formato_senha
FROM usuarios 
WHERE email = 'hygordavidaraujo@gmail.com';

-- PASSO 4: Testar comparação (resultado deve ser 1 se a senha for correta)
-- Esta query não funciona direto em SQL, mas aqui está para referência
-- A senha 123456 deve combinar com o hash $2b$10$YKUaPPO67xfocTzeHRjvfeMjVL1VE1rZ9wiQgheauM9qPx2OW2p/q
