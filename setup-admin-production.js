// Script para setup do admin DIRETO no Railway via DATABASE_URL
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function setupAdminRailway() {
    try {
        // Usar DATABASE_URL se existir, senão usar env vars
        let connection;
        
        if (process.env.DATABASE_URL) {
            console.log('🔄 Conectando via DATABASE_URL do Railway...');
            const url = new URL(process.env.DATABASE_URL);
            connection = await mysql.createConnection({
                host: url.hostname,
                user: url.username,
                password: url.password,
                database: url.pathname.substring(1),
                port: url.port || 3306,
                waitForConnections: true,
                connectionLimit: 1,
                queueLimit: 0
            });
        } else {
            console.log('🔄 Conectando via variáveis de ambiente...');
            connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            });
        }
        
        console.log('✅ Conectado ao banco!\n');
        
        const senhaAdmin = '123456'; // MUDE DEPOIS!
        const hashBcrypt = await bcrypt.hash(senhaAdmin, 10);
        
        console.log('📝 Atualizando admin...');
        console.log(`   Email: hygordavidaraujo@gmail.com`);
        console.log(`   Senha: ${senhaAdmin}\n`);
        
        // Atualizar ou inserir admin
        const [result] = await connection.execute(
            `INSERT INTO usuarios (nome_completo, telefone, email, senha, is_admin) 
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             senha = VALUES(senha), is_admin = VALUES(is_admin)`,
            ['Hygor David Araujo', '(62)98183-1483', 'hygordavidaraujo@gmail.com', hashBcrypt, true]
        );
        
        console.log(`✅ Usuário atualizado/criado!\n`);
        
        // Verificar
        const [usuarios] = await connection.execute(
            'SELECT id, email, nome_completo, is_admin FROM usuarios WHERE email = ?',
            ['hygordavidaraujo@gmail.com']
        );
        
        if (usuarios.length > 0) {
            console.log('✨ Status do admin:');
            console.table(usuarios);
        }
        
        console.log('\n🎯 Próximos passos:');
        console.log('1. Faça login com: hygordavidaraujo@gmail.com / 123456');
        console.log('2. Altere a senha após o login\n');
        
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('\n💡 Dica: Verifique as variáveis de ambiente DATABASE_URL');
        process.exit(1);
    }
}

setupAdminRailway();
