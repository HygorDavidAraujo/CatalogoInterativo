// ============================================
// UTILITÁRIO: Gerar hash bcrypt para senha
// USO: node gerar-hash-senha.js
// ============================================

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function gerarHash() {
    rl.question('Digite a senha para gerar o hash: ', async (senha) => {
        if (!senha || senha.length < 6) {
            console.error('\n❌ Senha deve ter no mínimo 6 caracteres');
            rl.close();
            return;
        }

        try {
            console.log('\n🔒 Gerando hash bcrypt...');
            const hash = await bcrypt.hash(senha, 10);
            
            console.log('\n✅ Hash gerado com sucesso!\n');
            console.log('════════════════════════════════════════════════════════════════');
            console.log('HASH BCRYPT:');
            console.log(hash);
            console.log('════════════════════════════════════════════════════════════════\n');
            console.log('Para atualizar no banco de dados (Railway/Local):');
            console.log('\nSQL:');
            console.log(`UPDATE usuarios SET senha = '${hash}' WHERE email = 'seu@email.com';`);
            console.log('\n💡 Substitua "seu@email.com" pelo email correto do usuário.\n');
            
        } catch (error) {
            console.error('\n❌ Erro ao gerar hash:', error.message);
        }
        
        rl.close();
    });
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  GERADOR DE HASH BCRYPT PARA SENHAS');
console.log('════════════════════════════════════════════════════════════════\n');

gerarHash();
