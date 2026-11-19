function mostrarMensagem(texto, tipo) {
    // Remover mensagens anteriores
    const mensagensAnteriores = document.querySelectorAll('.toast-message');
    mensagensAnteriores.forEach(msg => msg.remove());

    // Criar nova mensagem
    const mensagem = document.createElement('div');
    mensagem.className = `toast-message toast-${tipo}`;
    mensagem.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    mensagem.innerHTML = `
        <i class="fas fa-${tipo === 'sucesso' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span></span>
    `;
    mensagem.querySelector('span').textContent = texto;

    document.body.appendChild(mensagem);

    // Remover após 4 segundos
    setTimeout(() => {
        mensagem.classList.add('fade-out');
        setTimeout(() => mensagem.remove(), 300);
    }, 4000);
}

