require('dotenv').config();
const { pool } = require('./config/database');

async function criarTabelaPedidos() {
    try {
        console.log('===== CRIANDO TABELA DE PEDIDOS =====\n');
        
        // Criar tabela de pedidos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pendente',
                observacoes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela pedidos criada');

        // Criar tabela de itens do pedido
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pedidos_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido_id INT NOT NULL,
                vinho_id INT NOT NULL,
                vinho_nome VARCHAR(255) NOT NULL,
                quantidade INT NOT NULL,
                preco_unitario DECIMAL(10, 2) NOT NULL,
                subtotal DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
                FOREIGN KEY (vinho_id) REFERENCES vinhos(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela pedidos_itens criada');

        console.log('\n===== TABELAS CRIADAS COM SUCESSO! =====');
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error.message);
        process.exit(1);
    }
}

criarTabelaPedidos();
