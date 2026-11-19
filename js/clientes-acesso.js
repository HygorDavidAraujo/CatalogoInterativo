// Proteger página admin
(function() {
    const usuarioSalvo = sessionStorage.getItem('usuario');
    if (usuarioSalvo) {
        const usuario = JSON.parse(usuarioSalvo);
        if (usuario.isAdmin === true) {
            window.location.replace(`admin.html${window.location.search}#clientes`);
            return;
        }
    }
    alert('Acesso negado! Apenas administradores podem acessar esta página.');
    window.location.href = 'index.html';
})();
