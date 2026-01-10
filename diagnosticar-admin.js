// Script de diagnóstico do admin
require('dotenv').config();
const { pool } = require('./config/database');
const bcrypt = require('bcrypt');

async function diagnosticar() {
    try {
        console.log('🔍 DIAGNÓSTICO DO LOGIN DO ADMIN\n');
        
        // 1. Verificar se admin existe
        console.log('1️⃣  Verificando se admin existe...');
        const [usuarios] = await pool.query(
            'SELECT id, email, nome_completo, is_admin, senha FROM usuarios WHERE email = ?',
            ['hygordavidaraujo@gmail.com']
        );
        
        if (usuarios.length === 0) {
            console.log('❌ Admin NÃO EXISTE no banco!');
            process.exit(1);
        }
        
        const admin = usuarios[0];
        console.log('✅ Admin encontrado:');
        console.log(`   ID: ${admin.id}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Nome: ${admin.nome_completo}`);
        console.log(`   is_admin: ${admin.is_admin}`);
        console.log(`   Senha começa com: ${admin.senha.substring(0, 20)}...`);
        
        // 2. Verificar se senha é bcrypt
        console.log('\n2️⃣  Verificando formato da senha...');
        if (!admin.senha.startsWith('$2')) {
            console.log('❌ Senha NÃO está em formato bcrypt!');
            console.log('   Atualizando...');
            const novaSenha = '123456';
            const hash = await bcrypt.hash(novaSenha, 10);
            await pool.query(
                'UPDATE usuarios SET senha = ? WHERE id = ?',
                [hash, admin.id]
            );
            console.log(`✅ Senha atualizada!`);
            console.log(`   Nova senha: ${novaSenha}`);
        } else {
            console.log('✅ Senha está em formato bcrypt');
        }
        
        // 3. Testar comparação de senha
        console.log('\n3️⃣  Testando comparação de senha...');
        const [adminAtual] = await pool.query(
            'SELECT senha FROM usuarios WHERE id = ?',
            [admin.id]
        );
        
        const testesenha = '123456';
        const match = await bcrypt.compare(testesenha, adminAtual[0].senha);
        console.log(`   Senha de teste: "${testesenha}"`);
        console.log(`   Resultado: ${match ? '✅ MATCH!' : '❌ NÃO COMBINA'}`);
        
        // 4. Verificar JWT_SECRET
        console.log('\n4️⃣  Verificando JWT_SECRET...');
        const jwtSecret = process.env.JWT_SECRET || 'davini-vinhos-secret-key-2024';
        console.log(`   JWT_SECRET: ${jwtSecret.substring(0, 20)}...`);
        console.log(`   ⚠️  Se mudar no .env, reinicie o servidor!`);
        
        // 5. Resumo final
        console.log('\n📋 RESUMO:');
        console.log('✅ Admin existe');
        console.log('✅ Senha em bcrypt');
        console.log(`✅ Senha funciona: ${match}`);
        console.log('\n🎯 Tente fazer login com:');
        console.log('   Email: hygordavidaraujo@gmail.com');
        console.log('   Senha: 123456');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

diagnosticar();
