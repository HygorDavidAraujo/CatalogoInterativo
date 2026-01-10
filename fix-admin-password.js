// Script para atualizar senha do admin no Railway
require('dotenv').config();
const { pool } = require('./config/database');
const bcrypt = require('bcrypt');

async function fixAdminPassword() {
    try {
        console.log('🔄 Conectando ao banco de dados...');
        
        // Buscar admin
        const [admins] = await pool.query(
            'SELECT id, email, nome_completo, senha FROM usuarios WHERE email = ?',
            ['hygordavidaraujo@gmail.com']
        );
        
        if (admins.length === 0) {
            console.log('❌ Admin não encontrado!');
            console.log('Criando novo admin...');
            
            const novaSenha = '123456'; // ALTERE ESTA SENHA!
            const hash = await bcrypt.hash(novaSenha, 10);
            
            await pool.query(
                `INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['Hygor David Araujo', '(62)98183-1483', 'hygordavidaraujo@gmail.com', hash, true]
            );
            
            console.log('✅ Admin criado com sucesso!');
            console.log(`📧 Email: hygordavidaraujo@gmail.com`);
            console.log(`🔑 Senha: ${novaSenha}`);
            console.log('⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!');
        } else {
            const admin = admins[0];
            console.log(`✅ Admin encontrado: ${admin.nome_completo}`);
            console.log(`📧 Email: ${admin.email}`);
            
            // Verificar se a senha está em bcrypt
            if (!admin.senha || !admin.senha.startsWith('$2')) {
                console.log('⚠️  Senha não está em formato bcrypt!');
                console.log('🔄 Atualizando senha...');
                
                const novaSenha = '123456'; // ALTERE ESTA SENHA!
                const hash = await bcrypt.hash(novaSenha, 10);
                
                await pool.query(
                    'UPDATE usuarios SET senha = ?, is_admin = TRUE WHERE id = ?',
                    [hash, admin.id]
                );
                
                console.log('✅ Senha atualizada com sucesso!');
                console.log(`🔑 Nova senha: ${novaSenha}`);
                console.log('⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!');
            } else {
                console.log('✅ Senha já está em formato bcrypt');
                console.log('ℹ️  Se esqueceu a senha, edite este script e descomente as linhas abaixo:');
                console.log('');
                console.log('// Descomente para resetar a senha:');
                console.log('// const novaSenha = "sua_nova_senha_aqui";');
                console.log('// const hash = await bcrypt.hash(novaSenha, 10);');
                console.log('// await pool.query("UPDATE usuarios SET senha = ? WHERE id = ?", [hash, admin.id]);');
            }
        }
        
        // Verificar is_admin
        const [checkAdmin] = await pool.query(
            'SELECT id, email, is_admin FROM usuarios WHERE email = ?',
            ['hygordavidaraujo@gmail.com']
        );
        
        if (checkAdmin.length > 0) {
            console.log('\n📋 Status final do admin:');
            console.table(checkAdmin);
        }
        
        console.log('\n✨ Processo concluído!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

fixAdminPassword();
