// ===== GERENCIAMENTO DE MAIORIDADE =====
class IdadeManager {
    constructor() {
        this.storageKey = 'confirmacao_idade_18';
        this.mapaKey = 'mapa_bebidas_alcoolicas';
        this.confirmacao = null;
        this.mapaBebidas = {};
        this.modal = null;
        this.btnSim = null;
        this.btnNao = null;
        this.carregarEstado();
    }

    inicializar() {
        this.modal = document.getElementById('modal-idade');
        this.btnSim = document.getElementById('btn-idade-sim');
        this.btnNao = document.getElementById('btn-idade-nao');

        if (this.btnSim) {
            this.btnSim.addEventListener('click', () => this.confirmarMaioridade(true));
        }

        if (this.btnNao) {
            this.btnNao.addEventListener('click', () => this.confirmarMaioridade(false));
        }

        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.fecharModal();
                }
            });
        }

        if (this.confirmacao === null) {
            setTimeout(() => this.abrirModal(), 2000);
        }
    }

    carregarEstado() {
        const confirmacaoSalva = localStorage.getItem(this.storageKey);
        if (confirmacaoSalva !== null) {
            this.confirmacao = confirmacaoSalva === 'sim';
        }

        const mapaSalvo = localStorage.getItem(this.mapaKey);
        if (mapaSalvo) {
            try {
                this.mapaBebidas = JSON.parse(mapaSalvo) || {};
            } catch (error) {
                console.warn('Não foi possível ler o mapa de bebidas alcoólicas salvo:', error);
                this.mapaBebidas = {};
            }
        }
    }

    salvarEstado() {
        if (this.confirmacao === null) {
            localStorage.removeItem(this.storageKey);
        } else {
            localStorage.setItem(this.storageKey, this.confirmacao ? 'sim' : 'nao');
        }
        localStorage.setItem(this.mapaKey, JSON.stringify(this.mapaBebidas));
    }

    abrirModal() {
        if (this.modal) {
            this.modal.style.display = 'block';
        }
    }

    fecharModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    confirmarMaioridade(valor) {
        this.confirmacao = valor;
        this.salvarEstado();
        this.fecharModal();
    }

    podeComprarBebidaAlcoolica() {
        return this.confirmacao === true;
    }

    isBebidaAlcoolica(vinho) {
        if (!vinho) return true;

        const id = vinho.id ?? vinho.vinho_id;
        if (id && typeof this.mapaBebidas[id] === 'boolean') {
            return this.mapaBebidas[id];
        }

        const tipo = (vinho.tipo || '').toLowerCase();
        const tiposNaoAlcoolicos = [
            'suco_integral_tinto',
            'suco_integral_branco',
            'suco_integral',
            'sem_alcool',
            'sem-alcool',
            'alcool_free',
            'nao_alcoolico'
        ];

        if (tipo) {
            return !tiposNaoAlcoolicos.includes(tipo);
        }

        return true;
    }

    marcarBebidaAlcoolica(id, valor) {
        if (!id) return;
        this.mapaBebidas[id] = Boolean(valor);
        this.salvarEstado();
    }
}

window.idadeManager = new IdadeManager();

document.addEventListener('DOMContentLoaded', () => {
    window.idadeManager.inicializar();
});
