(function(){
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const tokenInput = document.getElementById('reset-token');
  const form = document.getElementById('form-reset-senha');
  const erroDiv = document.getElementById('reset-erro');
  const sucessoDiv = document.getElementById('reset-sucesso');

  if (tokenInput) tokenInput.value = token;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroDiv.style.display = 'none';
    sucessoDiv.style.display = 'none';

    const nova = document.getElementById('nova-senha').value;
    const conf = document.getElementById('confirmar-senha').value;
    const t = document.getElementById('reset-token').value;

    if (!t) {
      erroDiv.textContent = 'Token ausente. Use o link recebido por e-mail.';
      erroDiv.style.display = 'block';
      return;
    }
    if (!nova || nova.length < 6) {
      erroDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      erroDiv.style.display = 'block';
      return;
    }
    if (nova !== conf) {
      erroDiv.textContent = 'As senhas não conferem.';
      erroDiv.style.display = 'block';
      return;
    }

    try {
      const resp = await fetch(`${API_URL}/auth/recuperar/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, novaSenha: nova })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        erroDiv.textContent = data.error || 'Erro ao redefinir senha.';
        erroDiv.style.display = 'block';
        return;
      }
      sucessoDiv.textContent = data.message || 'Senha redefinida com sucesso. Faça login.';
      sucessoDiv.style.display = 'block';
      form.reset();
    } catch (err) {
      erroDiv.textContent = 'Erro ao comunicar com o servidor.';
      erroDiv.style.display = 'block';
    }
  });
})();