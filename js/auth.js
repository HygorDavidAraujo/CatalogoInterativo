// ===== GERENCIAMENTO DE AUTENTICAÇÃO =====
class AuthManager {
    constructor() {
        this.usuarioLogado = null;
        this.carregarUsuarioSessao();
    }

    salvarUsuarioSessao(usuario) {
        this.usuarioLogado = usuario;
        sessionStorage.setItem('usuario', JSON.stringify(usuario));
        this.atualizarInterface();
    }

    carregarUsuarioSessao() {
        const usuarioSalvo = sessionStorage.getItem('usuario');
        if (usuarioSalvo) {
            this.usuarioLogado = JSON.parse(usuarioSalvo);
            this.atualizarInterface();
        }
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

        if (!menuLogin || !menuUsuario || !menuAdmin) {
            console.error('Elementos do menu não encontrados');
            return;
        }

        if (this.isLogado()) {
            // Usuário logado
            console.log('Usuário está logado:', this.usuarioLogado.nome);
            console.log('É admin?', this.isAdmin());
            console.log('isAdmin valor:', this.usuarioLogado.isAdmin, typeof this.usuarioLogado.isAdmin);
            
            menuLogin.style.display = 'none';
            menuUsuario.style.display = 'flex';
            
            // Mostrar nome do usuário
            const primeiroNome = this.usuarioLogado.nome.split(' ')[0];
            usuarioNome.textContent = primeiroNome;

            // Mostrar menu admin se for admin
            if (this.isAdmin()) {
                console.log('Mostrando menu admin');
                menuAdmin.style.display = 'block';
            } else {
                console.log('Ocultando menu admin');
                menuAdmin.style.display = 'none';
            }
        } else {
            // Usuário não logado
            console.log('Usuário não está logado');
            menuLogin.style.display = 'block';
            menuUsuario.style.display = 'none';
            menuAdmin.style.display = 'none';
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
            this.salvarUsuarioSessao(data.usuario);
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

// Instância global
const authManager = new AuthManager();

// ===== MODAL DE AUTENTICAÇÃO =====
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
    document.getElementById('form-login').reset();
    document.getElementById('form-cadastro').reset();
    document.getElementById('login-erro').style.display = 'none';
    document.getElementById('cadastro-erro').style.display = 'none';
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
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;

        const resultado = await authManager.login(email, senha);

        if (resultado.success) {
            fecharModalAuth();
            location.reload(); // Recarregar para atualizar interface
        } else {
            mostrarErro('login-erro', resultado.error);
        }
    });
}

// ===== FORMULÁRIO DE CADASTRO =====
function configurarFormCadastro() {
    const form = document.getElementById('form-cadastro');
    const telefoneInput = document.getElementById('cadastro-telefone');

    // Formatar telefone enquanto digita
    telefoneInput.addEventListener('input', function() {
        formatarTelefone(this);
    });

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

    // Configurar formulários
    configurarFormLogin();
    configurarFormCadastro();
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
    authManager.atualizarInterface();
}
