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
            this.usuarioLogado = JSON.parse(usuarioSalvo);
            this.atualizarInterface();
        }
    }

    obterToken() {
        return sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token');
    }

    logout() {
        this.usuarioLogado = null;
        sessionStorage.removeItem('usuario');
        this.atualizarInterface();
        location.reload();
    }

    isLogado() {
        return this.usuarioLogado !== null;
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
                throw new Error(data.error || 'Erro ao fazer login');
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
                throw new Error(data.error || 'Erro ao cadastrar');
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
// ===== MODAL DE ATUALIZAÇÃO DE SENHA FORÇADA =====
document.addEventListener('DOMContentLoaded', function() {
    const modalAtualizarSenha = document.getElementById('modal-atualizar-senha');
    const closeAtualizarSenha = document.querySelector('.close-atualizar-senha');
    if (closeAtualizarSenha) {
        closeAtualizarSenha.addEventListener('click', function() {
            modalAtualizarSenha.style.display = 'none';
            document.getElementById('modal-auth').style.display = 'block';
        });
    }

    const formAtualizarSenha = document.getElementById('form-atualizar-senha');
    if (formAtualizarSenha) {
        formAtualizarSenha.addEventListener('submit', async function(e) {
            e.preventDefault();
            const novaSenha = document.getElementById('atualizar-nova-senha').value;
            const confirmarSenha = document.getElementById('atualizar-confirmar-senha').value;
            const erroDiv = document.getElementById('atualizar-senha-erro');
            erroDiv.style.display = 'none';
            if (novaSenha.length < 6) {
                erroDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.';
                erroDiv.style.display = 'block';
                return;
            }
            if (novaSenha !== confirmarSenha) {
                erroDiv.textContent = 'As senhas não coincidem.';
                erroDiv.style.display = 'block';
                return;
            }
            // Enviar nova senha ao backend
            try {
                const email = window.emailParaAtualizarSenha;
                const response = await fetch(`${API_URL}/auth/atualizar-senha`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, novaSenha })
                });
                const data = await response.json();
                if (!response.ok) {
                    erroDiv.textContent = data.error || 'Erro ao atualizar senha.';
                    erroDiv.style.display = 'block';
                    return;
                }
                // Senha atualizada, tentar login automaticamente
                modalAtualizarSenha.style.display = 'none';
                document.getElementById('modal-auth').style.display = 'block';
                document.getElementById('login-senha').value = novaSenha;
                mostrarErro('login-erro', 'Senha atualizada! Faça login novamente.');
            } catch (err) {
                erroDiv.textContent = 'Erro ao atualizar senha.';
                erroDiv.style.display = 'block';
            }
        });
    }
});
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
            if (resultado.error && resultado.error.includes('precisa ser atualizada')) {
                // Exibir modal de atualização de senha forçada
                document.getElementById('modal-auth').style.display = 'none';
                document.getElementById('modal-atualizar-senha').style.display = 'block';
                document.getElementById('atualizar-senha-erro').style.display = 'none';
                // Salvar email temporariamente para atualização
                window.emailParaAtualizarSenha = document.getElementById('login-email').value.trim();
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

    // Formatar telefone enquanto digita
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function() {
            formatarTelefone(this);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
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
    });
}

// ===== CONFIGURAR BOTÕES E EVENTOS =====
function configurarAuth() {
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
            document.getElementById('modal-auth').style.display = 'none';
            if (modalRecuperar) modalRecuperar.style.display = 'block';
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

            // Se backend retornar senha temporária (fallback), exibir ao usuário
            if (data.tempSenha) {
                sucessoDiv.innerHTML = `Senha temporária: <strong>${data.tempSenha}</strong> — altere após o login.`;
            } else {
                sucessoDiv.textContent = data.message || 'Verifique seu e-mail para instruções de recuperação.';
            }
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
    
    // Quando VipManager carregar, atualizar interface novamente para badges dinâmicas
    if (window.vipManager) {
        window.vipManager.onReady(() => {
            console.log('✓ VipManager pronto, atualizando interface...');
            window.authManager.atualizarInterface();
        });
    }
}
