require('dotenv').config();
const { pool } = require('./config/database');

async function testarUsuarios() {
    try {
        console.log('===== TESTANDO CONSULTA DE USUÁRIOS =====\n');
        
        const [usuarios] = await pool.query(
            'SELECT id, nome_completo, email, telefone, is_admin, created_at FROM usuarios ORDER BY created_at DESC'
        );
        
        console.log(`Total de usuários encontrados: ${usuarios.length}\n`);
        
        if (usuarios.length > 0) {
            console.log('Lista de usuários:');
            usuarios.forEach(usuario => {
                console.log(`\nID: ${usuario.id}`);
                console.log(`Nome: ${usuario.nome_completo}`);
                console.log(`Email: ${usuario.email}`);
                console.log(`Telefone: ${usuario.telefone || 'Não informado'}`);
                console.log(`Admin: ${usuario.is_admin ? 'Sim' : 'Não'}`);
                console.log(`Cadastro: ${usuario.created_at}`);
            });
        } else {
            console.log('Nenhum usuário cadastrado no banco de dados.');
        }
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

testarUsuarios();
