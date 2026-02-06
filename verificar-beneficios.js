// Script para verificar benefícios VIP no banco de dados
const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'shinkansen.proxy.rlwy.net',
    port: 17740,
    user: 'root',
    password: 'MmAfPhyjxuZDBtuwVZilwfXoIPPQJOyT',
    database: 'railway'
};

async function verificarBeneficios() {
    let connection;
    
    try {
        console.log('🔌 Conectando ao banco de dados...\n');
        connection = await mysql.createConnection(dbConfig);

        // Listar todos os benefícios
        console.log('📊 TODOS OS BENEFÍCIOS VIP:');
        const [beneficios] = await connection.query('SELECT * FROM beneficios_vip ORDER BY ordem');
        
        beneficios.forEach(b => {
            const tipo = b.tipo_desconto === 'percentual' ? `${b.valor_desconto}%` : `R$ ${b.valor_desconto.toFixed(2)}`;
            const ativo = b.ativo ? '✓ Ativo' : '✗ Inativo';
            console.log(`\n  ID: ${b.id}`);
            console.log(`  Nome: ${b.nome}`);
            console.log(`  Slug: ${b.slug}`);
            console.log(`  Desconto: ${tipo}`);
            console.log(`  Cor: ${b.cor || 'SEM COR'}`);
            console.log(`  Status: ${ativo}`);
            console.log(`  Ordem: ${b.ordem}`);
        });

        // Verificar se "atacado" existe e está com cor correta
        console.log('\n\n🔍 BUSCANDO "Preço - Atacado":');
        const [atacado] = await connection.query(
            'SELECT * FROM beneficios_vip WHERE slug = "atacado"'
        );
        
        if (atacado.length > 0) {
            const b = atacado[0];
            console.log(`✓ Encontrado!`);
            console.log(`  Nome: ${b.nome}`);
            console.log(`  Cor: ${b.cor || 'SEM COR (usar padrão #6B1C40)'}`);
            console.log(`  Tipo Desconto: ${b.tipo_desconto}`);
            console.log(`  Valor: ${b.valor_desconto}`);
        } else {
            console.log('✗ Benefício "atacado" não encontrado no banco');
        }

        // Verificar usuários com vip_tipo = 'atacado'
        console.log('\n\n👤 USUÁRIOS COM VIP "ATACADO":');
        const [usuarios] = await connection.query(
            'SELECT id, nome_completo, vip_tipo, is_vip FROM usuarios WHERE vip_tipo = "atacado"'
        );
        
        if (usuarios.length === 0) {
            console.log('  (Nenhum usuário com VIP Atacado)');
        } else {
            usuarios.forEach(u => {
                const vip = u.is_vip ? '✓ VIP' : '✗ Não VIP';
                console.log(`  - ID ${u.id}: ${u.nome_completo} (${vip})`);
            });
        }

        console.log('\n✅ Verificação concluída!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

verificarBeneficios();
