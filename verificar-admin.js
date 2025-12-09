const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarAdmin() {
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '79461382',
            database: 'catalogo_vinhos'
        });

        const [rows] = await conn.query('SELECT * FROM usuarios WHERE email = ?', ['hygordavidaraujo@gmail.com']);
        
        console.log('Usuário encontrado:');
        console.log(rows[0]);
        console.log('\nValor de is_admin:', rows[0].is_admin);
        console.log('Tipo:', typeof rows[0].is_admin);
        console.log('Boolean:', Boolean(rows[0].is_admin));
        console.log('Comparação === 1:', rows[0].is_admin === 1);
        console.log('Comparação == true:', rows[0].is_admin == true);

        await conn.end();
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error.message);
        process.exit(1);
    }
}

verificarAdmin();
