// Uma janela aberta por push pode ter token persistido, mas não sessionStorage.
(async function() {
    const auth = window.authManager;
    if (!auth?.obterToken()) { window.location.replace('index.html'); return; }
    const valido = await auth.validarSessao();
    if (valido === true && auth.isAdmin()) return;
    if (valido === null) {
        const mensagem = document.createElement('p');
        mensagem.setAttribute('role', 'alert');
        mensagem.textContent = 'Não foi possível verificar o acesso. Recarregue o painel para tentar novamente.';
        document.querySelector('main')?.prepend(mensagem);
        return;
    }
    window.location.replace('index.html');
})();
