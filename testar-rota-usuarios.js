const fetch = require('node-fetch');

async function testarRotaUsuarios() {
    try {
        console.log('Testando rota /api/auth/usuarios...\n');
        
        const response = await fetch('http://localhost:3000/api/auth/usuarios');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        
        const data = await response.json();
        console.log('\nDados recebidos:');
        console.log(JSON.stringify(data, null, 2));
        
        console.log(`\nTotal de usuários: ${data.length}`);
        
    } catch (error) {
        console.error('Erro ao testar rota:', error.message);
    }
}

testarRotaUsuarios();
