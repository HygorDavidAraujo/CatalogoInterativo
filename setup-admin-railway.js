// Script para atualizar senha do admin no Railway
require('dotenv').config();
const { pool } = require('./config/database');
const bcrypt = require('bcrypt');

async function setupAdminPassword() {
    try {
        console.log('🔄 Conectando ao banco de dados do Railway...');
        
        const senhaAdmin = '123456'; // MUDE ISTO DEPOIS!
        const hashBcrypt = await bcrypt.hash(senhaAdmin, 10);
        
        console.log('\n📝 Gerando hash bcrypt...');
        console.log(`📧 Email: hygordavidaraujo@gmail.com`);
        console.log(`🔑 Senha: ${senhaAdmin}`);
        console.log(`🔐 Hash: ${hashBcrypt}\n`);
        
        // Atualizar admin
        console.log('💾 Atualizando banco de dados...');
        const result = await pool.query(
            `UPDATE usuarios 
             SET senha = ?, is_admin = TRUE 
             WHERE email = ?`,
            [hashBcrypt, 'hygordavidaraujo@gmail.com']
        );
        
        console.log(`✅ ${result[0].changedRows} usuário(s) atualizado(s)\n`);
        
        // Verificar
        const [usuarios] = await pool.query(
            'SELECT id, email, nome_completo, is_admin FROM usuarios WHERE email = ?',
            ['hygordavidaraujo@gmail.com']
        );
        
        if (usuarios.length > 0) {
            console.log('✨ Admin configurado com sucesso!');
            console.table(usuarios);
        } else {
            console.log('❌ Admin não encontrado! Criando novo...');
            
            await pool.query(
                `INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['Hygor David Araujo', '(62)98183-1483', 'hygordavidaraujo@gmail.com', hashBcrypt, true]
            );
            
            console.log('✅ Admin criado com sucesso!');
        }
        
        console.log('\n🎯 Próximo passo:');
        console.log('1. Faça login com: hygordavidaraujo@gmail.com / 123456');
        console.log('2. Vá em Admin > Gerenciar Clientes > Editar seu usuário');
        console.log('3. Altere a senha para algo mais seguro');
        console.log('\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

setupAdminPassword();
