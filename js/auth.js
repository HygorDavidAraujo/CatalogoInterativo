// ===== GERENCIAMENTO DE AUTENTICAÇÃO =====
class AuthManager {
    constructor() {
        this.usuarioLogado = null;
        this.carregarUsuarioSessao();
    }

    salvarUsuarioSessao(usuario, token) {
        this.usuarioLogado = usuario;
        sessionStorage.setItem('usuario', JSON.stringify(usuario));
        if (token) {
            sessionStorage.setItem('jwt_token', token);
            localStorage.setItem('jwt_token', token);
        }
        this.atualizarInterface();
    }

    carregarUsuarioSessao() {
        const usuarioSalvo = sessionStorage.getItem('usuario');
        if (usuarioSalvo) {
            try {
                const usuario = JSON.parse(usuarioSalvo);
                if (!this.obterToken() || !usuario || typeof usuario.nome !== 'string') {
                    this.limparSessao();
                    return;
                }
                this.usuarioLogado = usuario;
                this.atualizarInterface();
            } catch (error) {
                this.limparSessao();
            }
        }
    }

    obterToken() {
        // O último login compartilhado entre abas prevalece sobre o cache da aba.
        return localStorage.getItem('jwt_token') || sessionStorage.getItem('jwt_token');
    }

    limparSessao() {
        this.usuarioLogado = null;
        ['usuario', 'jwt_token'].forEach(chave => {
            sessionStorage.removeItem(chave);
            localStorage.removeItem(chave);
        });
        this.atualizarInterface();
        window.carrinhoManager?.atualizarInterface();
    }

    redirecionarSemSessao() {
        const path = window.location.pathname;
        if (/\/(admin(?:\.html)?|clientes\.html|meu-perfil\.html)$/.test(path)) {
            window.location.href = 'index.html';
        } else {
            location.reload();
        }
    }

    async logout() {
        if (this.saindo) return;
        this.saindo = true;
        const token = this.obterToken();
        // Limpa imediatamente, mesmo se a conexão estiver indisponível.
        this.limparSessao();
        let timeoutId;
        try {
            if (token) {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    keepalive: true,
                    signal: controller.signal
                });
                if (!response.ok && response.status !== 401) {
                    throw new Error('Falha ao encerrar sessão');
                }
            }
        } catch (error) {
            alert('Você saiu deste navegador, mas não foi possível encerrar a sessão no servidor. Se perdeu a conexão, redefina sua senha ao reconectar para revogar as sessões anteriores.');
        } finally {
            clearTimeout(timeoutId);
            this.saindo = false;
            this.redirecionarSemSessao();
        }
    }

    async validarSessao() {
        if (this.validandoSessao) return;
        const token = this.obterToken();
        if (!token) {
            this.limparSessao();
            return false;
        }
        this.validandoSessao = true;
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Não restaura uma sessão que foi encerrada/trocada durante a consulta.
            if (token !== this.obterToken()) return false;
            if (response.status === 401) {
                const estavaLogado = this.usuarioLogado !== null;
                this.limparSessao();
                if (estavaLogado) this.redirecionarSemSessao();
                return false;
            }
            // Falhas temporárias do banco ou da rede não apagam credenciais válidas.
            if (!response.ok) return null;
            const usuario = await response.json();
            if (token !== this.obterToken()) return false;
            this.salvarUsuarioSessao(usuario, token);
            return true;
        } catch (error) {
            return null;
        } finally {
            this.validandoSessao = false;
        }
    }

    isLogado() {
        return this.usuarioLogado !== null && !!this.obterToken();
    }

    isAdmin() {
        return this.usuarioLogado && this.usuarioLogado.isAdmin === true;
    }

    atualizarInterface() {
        console.log('Atualizando interface...', this.usuarioLogado);
        
        const menuLogin = document.getElementById('menu-login');
        const menuUsuario = document.getElementById('menu-usuario');
        const menuAdmin = document.getElementById('menu-admin');
        const usuarioNome = document.getElementById('usuario-nome');
        const badgeVipHeader = document.getElementById('badge-vip-header');

        // Verificar se é página com menu simplificado (como meu-perfil.html)
        const isPaginaSimplificada = !menuLogin && !menuAdmin;
        
        // Se não tem elemento de usuário em nenhuma página, não faz nada
        if (!usuarioNome && !badgeVipHeader) {
            console.debug('Interface não encontrada nesta página.');
            return;
        }

        // Se não é página simplificada e faltam elementos principais, ignore
        if (!isPaginaSimplificada && (!menuLogin || !menuUsuario || !menuAdmin)) {
            console.debug('Interface simplificada: elementos de menu não presentes nesta página.');
            return;
        }

        const menuPerfil = document.getElementById('menu-perfil');

        if (this.isLogado()) {
            // Usuário logado
            console.log('Usuário está logado:', this.usuarioLogado.nome);
            console.log('É admin?', this.isAdmin());
            
            // Atualizar menus (se existirem)
            if (menuLogin) menuLogin.style.display = 'none';
            if (menuUsuario) menuUsuario.style.display = 'flex';
            
            // Mostrar nome do usuário
            if (usuarioNome) {
                const primeiroNome = this.usuarioLogado.nome.split(' ')[0];
                usuarioNome.textContent = primeiroNome;
            }

            // Mostrar badge VIP se aplicável
            if (badgeVipHeader && this.usuarioLogado.is_vip && this.usuarioLogado.vip_tipo) {
                const vipTipo = this.usuarioLogado.vip_tipo;
                
                // Aguardar VipManager estar pronto
                if (window.vipManager && window.vipManager.beneficios.length > 0) {
                    const badgeHTML = window.vipManager.getBadgeHtml(vipTipo);
                    badgeVipHeader.innerHTML = badgeHTML;
                    badgeVipHeader.style.display = 'inline-block';
                    console.log('✓ Badge VIP exibido:', vipTipo);
                } else {
                    // Fallback enquanto VipManager carrega
                    console.log('⏳ VipManager ainda carregando, usando fallback...');
                    const iconMap = { 'diamante': '💎', 'ouro': '✨', 'prata': '⭐', 'default': '⭐' };
                    const icon = iconMap[vipTipo] || iconMap['default'];
                    const nomeBeneficio = window.vipManager?.getNomeBeneficio(vipTipo) || `VIP ${vipTipo}`;
                    badgeVipHeader.innerHTML = `${icon} ${nomeBeneficio}`;
                    badgeVipHeader.style.display = 'inline-block';
                }
            } else if (badgeVipHeader) {
                badgeVipHeader.style.display = 'none';
            }

            // Mostrar menu admin se for admin (apenas se elementos existirem)
            if (menuAdmin) {
                if (this.isAdmin()) {
                    console.log('Mostrando menu admin');
                    menuAdmin.style.display = 'block';
                    if (menuPerfil) menuPerfil.style.display = 'none';
                } else {
                    console.log('Ocultando menu admin');
                    menuAdmin.style.display = 'none';
                    if (menuPerfil) menuPerfil.style.display = 'block';
                }
            }
        } else {
            // Usuário não logado
            console.log('Usuário não está logado');
            if (menuLogin) menuLogin.style.display = 'block';
            if (menuUsuario) menuUsuario.style.display = 'none';
            if (menuAdmin) menuAdmin.style.display = 'none';
            if (menuPerfil) menuPerfil.style.display = 'none';
            if (badgeVipHeader) badgeVipHeader.style.display = 'none';
        }
    }

    async login(email, senha) {
        try {
            console.log('Fazendo login...', email);
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();
            console.log('Resposta da API:', data);

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || 'Erro ao fazer login',
                    code: data.code
                };
            }

            console.log('Dados do usuário recebidos:', data.usuario);
            // Agora passa o token JWT se fornecido pela API
            this.salvarUsuarioSessao(data.usuario, data.token);
            return { success: true };
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, error: error.message };
        }
    }

    async cadastrar(dados) {
        try {
            const response = await fetch(`${API_URL}/auth/cadastro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });

            const data = await response.json();

            if (!response.ok) {
                const detalhes = Array.isArray(data.details)
                    ? [...new Set(data.details.map(item => item.message).filter(message => typeof message === 'string'))]
                    : [];
                let mensagem = detalhes.length ? detalhes.join('. ') : data.error || 'Erro ao cadastrar';
                if (response.status === 429) {
                    const segundos = Number(response.headers?.get('Retry-After'));
                    if (Number.isFinite(segundos) && segundos > 0) {
                        mensagem = `Muitas solicitações de cadastro. Aguarde ${Math.ceil(segundos / 60)} minuto(s) antes de tentar novamente.`;
                    }
                }
                throw new Error(mensagem);
            }

            this.salvarUsuarioSessao(data.usuario);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Instância global - acessível de qualquer lugar
window.authManager = new AuthManager();
console.log('✓ authManager criado e disponível globalmente');

// ===== MODAL DE AUTENTICAÇÃO =====
function abrirModalRecuperarSenha(email = '') {
    const modalRecuperar = document.getElementById('modal-recuperar-senha');
    if (!modalRecuperar) return false;

    const modalAuth = document.getElementById('modal-auth');
    if (modalAuth) modalAuth.style.display = 'none';
    const senhaInput = document.getElementById('login-senha');
    if (senhaInput) senhaInput.value = '';

    const emailInput = document.getElementById('recuperar-email');
    if (emailInput) emailInput.value = email;
    ['recuperar-senha-erro', 'recuperar-senha-sucesso'].forEach(id => {
        const mensagem = document.getElementById(id);
        if (mensagem) mensagem.style.display = 'none';
    });
    modalRecuperar.style.display = 'block';
    emailInput?.focus();
    return true;
}

function abrirModalAuth() {
    console.log('Abrindo modal de autenticação...');
    const modal = document.getElementById('modal-auth');
    if (!modal) {
        console.error('Modal auth não encontrado!');
        return;
    }
    mostrarFormLogin();
    modal.style.display = 'block';
    console.log('Modal aberto com sucesso');
}

function fecharModalAuth() {
    const modal = document.getElementById('modal-auth');
    modal.style.display = 'none';
    limparFormsAuth();
}

function mostrarFormLogin() {
    document.getElementById('form-login-container').style.display = 'block';
    document.getElementById('form-cadastro-container').style.display = 'none';
    limparFormsAuth();
}

function mostrarFormCadastro() {
    document.getElementById('form-login-container').style.display = 'none';
    document.getElementById('form-cadastro-container').style.display = 'block';
    limparFormsAuth();
}

function limparFormsAuth() {
    const formLogin = document.getElementById('form-login');
    const formCadastro = document.getElementById('form-cadastro');
    const loginErro = document.getElementById('login-erro');
    const cadastroErro = document.getElementById('cadastro-erro');
    if (formLogin) formLogin.reset();
    if (formCadastro) formCadastro.reset();
    if (loginErro) loginErro.style.display = 'none';
    if (cadastroErro) cadastroErro.style.display = 'none';
}

function mostrarErro(elementId, mensagem) {
    const elemento = document.getElementById(elementId);
    elemento.textContent = mensagem;
    elemento.style.display = 'block';
}

// ===== FORMATAÇÃO DE TELEFONE =====
function formatarTelefone(input) {
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length <= 10) {
        valor = valor.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1)$2-$3');
    } else {
        valor = valor.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1)$2-$3');
    }
    
    input.value = valor;
}

// ===== FORMULÁRIO DE LOGIN =====
function configurarFormLogin() {
    const form = document.getElementById('form-login');
    if (!form) return; // página sem modal de login
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;

        const resultado = await authManager.login(email, senha);

        if (resultado.success) {
            fecharModalAuth();
            location.reload(); // Recarregar para atualizar interface
        } else {
            if (resultado.code === 'PASSWORD_RESET_REQUIRED' ||
                resultado.error?.includes('precisa ser atualizada')) {
                if (!abrirModalRecuperarSenha(email)) {
                    mostrarErro('login-erro', resultado.error);
                }
            } else {
                mostrarErro('login-erro', resultado.error);
            }
        }
    });
}

// ===== FORMULÁRIO DE CADASTRO =====
function configurarFormCadastro() {
    const form = document.getElementById('form-cadastro');
    const telefoneInput = document.getElementById('cadastro-telefone');
    if (!form) return; // página sem modal de cadastro
    if (form.dataset.cadastroConfigurado) return;
    form.dataset.cadastroConfigurado = 'true';

    // Formatar telefone enquanto digita
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function() {
            formatarTelefone(this);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (form.dataset.enviando === 'true') return;
        
        const nome = document.getElementById('cadastro-nome').value.trim();
        const telefone = document.getElementById('cadastro-telefone').value.trim();
        const email = document.getElementById('cadastro-email').value.trim();
        const senha = document.getElementById('cadastro-senha').value;
        const confirmarSenha = document.getElementById('cadastro-confirmar-senha').value;

        // Validar senhas
        if (senha !== confirmarSenha) {
            mostrarErro('cadastro-erro', 'As senhas não coincidem');
            return;
        }

        if (senha.length < 6 || senha.length > 100 || !/[a-z]/.test(senha)) {
            mostrarErro('cadastro-erro', 'Senha deve ter entre 6 e 100 caracteres e pelo menos uma letra minúscula.');
            return;
        }

        const botao = form.querySelector('button[type="submit"]');
        form.dataset.enviando = 'true';
        if (botao) botao.disabled = true;
        try {
            const resultado = await authManager.cadastrar({
                nome_completo: nome,
                telefone: telefone,
                email: email,
                senha: senha
            });

            if (resultado.success) {
                fecharModalAuth();
                location.reload(); // Recarregar para atualizar interface
            } else {
                mostrarErro('cadastro-erro', resultado.error);
            }
        } finally {
            form.dataset.enviando = 'false';
            if (botao) botao.disabled = false;
        }
    });
}

// ===== CONFIGURAR BOTÕES E EVENTOS =====
function configurarAuth() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'jwt_token' && event.newValue === null) {
            const estavaLogado = window.authManager.usuarioLogado !== null;
            window.authManager.limparSessao();
            if (estavaLogado) window.authManager.redirecionarSemSessao();
        } else if (event.key === 'jwt_token' && event.newValue !== sessionStorage.getItem('jwt_token')) {
            // Um login em outra aba não deve continuar exibindo o usuário anterior.
            sessionStorage.removeItem('usuario');
            sessionStorage.setItem('jwt_token', event.newValue);
            window.authManager.usuarioLogado = null;
            location.reload();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) window.authManager.validarSessao();
    });
    // Verificar se elementos existem antes de adicionar listeners
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const closeAuth = document.querySelector('.close-auth');
    const mostrarCadastro = document.getElementById('mostrar-cadastro');
    const mostrarLogin = document.getElementById('mostrar-login');
    const modalAuth = document.getElementById('modal-auth');

    // Botão login
    if (btnLogin) {
        btnLogin.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botão login clicado');
            abrirModalAuth();
        });
    }

    // Botão logout
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Deseja realmente sair?')) {
                authManager.logout();
            }
        });
    }

    // Fechar modal
    if (closeAuth) {
        closeAuth.addEventListener('click', fecharModalAuth);
    }

    // Esqueci a senha - abrir modal
    const esqueciSenhaLink = document.getElementById('esqueci-senha-link');
    const modalRecuperar = document.getElementById('modal-recuperar-senha');
    const closeRecuperar = document.querySelector('.close-recuperar-senha');
    const voltarLoginFromRecuperar = document.getElementById('voltar-login-from-recuperar');

    if (esqueciSenhaLink) {
        esqueciSenhaLink.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalRecuperarSenha(document.getElementById('login-email')?.value.trim() || '');
        });
    }

    if (closeRecuperar) {
        closeRecuperar.addEventListener('click', () => {
            if (modalRecuperar) modalRecuperar.style.display = 'none';
            document.getElementById('modal-auth').style.display = 'block';
        });
    }

    if (voltarLoginFromRecuperar) {
        voltarLoginFromRecuperar.addEventListener('click', (e) => {
            e.preventDefault();
            if (modalRecuperar) modalRecuperar.style.display = 'none';
            document.getElementById('modal-auth').style.display = 'block';
        });
    }

    // Alternar entre login e cadastro
    if (mostrarCadastro) {
        mostrarCadastro.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarFormCadastro();
        });
    }

    if (mostrarLogin) {
        mostrarLogin.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarFormLogin();
        });
    }

    // Fechar ao clicar fora
    if (modalAuth) {
        window.addEventListener('click', (e) => {
            if (e.target === modalAuth) {
                fecharModalAuth();
            }
        });
    }

    // Configurar formulários quando existirem na página
    configurarFormLogin();
    configurarFormCadastro();
    configurarFormRecuperarSenha();
}

// ===== FORMULÁRIO DE RECUPERAÇÃO DE SENHA =====
function configurarFormRecuperarSenha() {
    const form = document.getElementById('form-recuperar-senha');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recuperar-email').value.trim();
        const erroDiv = document.getElementById('recuperar-senha-erro');
        const sucessoDiv = document.getElementById('recuperar-senha-sucesso');
        erroDiv.style.display = 'none';
        sucessoDiv.style.display = 'none';

        if (!email) {
            erroDiv.textContent = 'Informe um e-mail válido.';
            erroDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/recuperar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Mensagem amigável: se backend não implementado, orientar contato com admin
                const msg = data.error || 'Não foi possível enviar instruções. Contate o suporte.';
                erroDiv.textContent = msg;
                erroDiv.style.display = 'block';
                return;
            }

            sucessoDiv.textContent = data.message || 'Verifique seu e-mail para instruções de recuperação.';
            sucessoDiv.style.display = 'block';
        } catch (err) {
            erroDiv.textContent = 'Erro ao enviar solicitação. Tente novamente mais tarde.';
            erroDiv.style.display = 'block';
        }
    });
}

// ===== INICIALIZAÇÃO =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarAuth);
} else {
    inicializarAuth();
}

function inicializarAuth() {
    console.log('Inicializando sistema de autenticação...');
    configurarAuth();
    window.authManager.atualizarInterface();
    window.authManager.validarSessao();
    
    // Quando VipManager carregar, atualizar interface novamente para badges dinâmicas
    if (window.vipManager) {
        window.vipManager.onReady(() => {
            console.log('✓ VipManager pronto, atualizando interface...');
            window.authManager.atualizarInterface();
        });
    }
}
