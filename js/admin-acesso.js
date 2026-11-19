// Proteger página admin - executar imediatamente
(function() {
    console.log('=== VERIFICAÇÃO DE ACESSO ADMIN ===');

    // Verificar sessionStorage diretamente
    const usuarioSalvo = sessionStorage.getItem('usuario');
    console.log('SessionStorage usuario:', usuarioSalvo);

    if (usuarioSalvo) {
        const usuario = JSON.parse(usuarioSalvo);
        console.log('Usuário parseado:', usuario);
        console.log('isAdmin:', usuario.isAdmin);

        if (usuario.isAdmin === true) {
            console.log('✅ Acesso permitido!');
            return; // Permitir acesso
        }
    }

    // Se chegou aqui, não tem acesso
    console.log('❌ Acesso negado! Redirecionando...');
    alert('Acesso negado! Apenas administradores podem acessar esta página.');
    window.location.href = 'index.html';
})();
