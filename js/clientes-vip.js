// Bloquear edição VIP para não-admins
document.addEventListener('DOMContentLoaded', function() {
    const usuarioSalvo = sessionStorage.getItem('usuario');
    let isAdmin = false;
    if (usuarioSalvo) {
        const usuario = JSON.parse(usuarioSalvo);
        isAdmin = usuario.isAdmin === true;
    }
    if (!isAdmin) {
        document.getElementById('edit-is-vip').disabled = true;
        document.getElementById('edit-vip-tipo').disabled = true;
    }
});
