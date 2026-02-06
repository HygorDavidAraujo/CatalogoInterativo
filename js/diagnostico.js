// Script para diagnosticar problemas de carregamento
const diagnostico = {
    verificar: function() {
        console.clear();
        console.log('=== DIAGNÓSTICO DO SISTEMA ===\n');
        
        // 1. Verificar managers
        console.log('📦 MANAGERS GLOBAIS:');
        console.log('  authManager:', typeof window.authManager !== 'undefined' ? '✓' : '✗');
        console.log('  carrinhoManager:', typeof window.carrinhoManager !== 'undefined' ? '✓' : '✗');
        console.log('  vipManager:', typeof window.vipManager !== 'undefined' ? '✓' : '✗');
        
        // 2. Verificar VipManager status
        if (window.vipManager) {
            console.log('\n🎁 VIP MANAGER:');
            console.log('  Carregado:', window.vipManager.carregado ? '✓' : '✗ (aguardando...)');
            console.log('  Benefícios:', window.vipManager.beneficios.length);
            if (window.vipManager.beneficios.length > 0) {
                window.vipManager.beneficios.forEach(b => {
                    console.log(`    - ${b.slug}: ${b.nome} (${b.valor_desconto}${b.tipo_desconto === 'percentual' ? '%' : ' R$'})`);
                });
            }
        }
        
        // 3. Verificar usuário logado
        if (window.authManager) {
            console.log('\n👤 AUTENTICAÇÃO:');
            const user = window.authManager.usuarioLogado;
            if (user) {
                console.log('  Logado:', user.nome_completo);
                console.log('  É VIP:', user.is_vip ? `✓ (${user.vip_tipo})` : '✗');
                
                // 4. Testar cálculo de desconto
                if (window.carrinhoManager) {
                    console.log('\n💰 TESTE DE DESCONTO:');
                    const precoTeste = 100;
                    const precoDesconto = window.carrinhoManager.getDescontoVip(precoTeste);
                    console.log(`  Preço original: R$ ${precoTeste.toFixed(2)}`);
                    console.log(`  Com desconto: R$ ${precoDesconto.toFixed(2)}`);
                    console.log(`  Economia: R$ ${(precoTeste - precoDesconto).toFixed(2)}`);
                }
            } else {
                console.log('  Não logado');
            }
        }
        
        // 5. Verificar carrinho
        if (window.carrinhoManager) {
            console.log('\n🛒 CARRINHO:');
            console.log('  Itens:', window.carrinhoManager.itens.length);
            console.log('  Total:', `R$ ${window.carrinhoManager.getTotal().toFixed(2)}`);
        }
        
        console.log('\n✅ Diagnóstico concluído\n');
    }
};

// Executar diagnóstico quando tudo estiver pronto
if (window.vipManager) {
    window.vipManager.onReady(() => {
        console.log('\n🔍 VipManager pronto, executando diagnóstico...\n');
        setTimeout(() => diagnostico.verificar(), 500);
    });
} else {
    setTimeout(() => diagnostico.verificar(), 1000);
}

// Expor diagnosticador no console
window.diagnostico = diagnostico;
console.log('📊 Diagnóstico disponível: digite diagnostico.verificar()');
