// ===== GERENCIADOR DE BENEFÍCIOS VIP =====
class VipManager {
    constructor() {
        this.beneficios = [];
        this.carregado = false;
        this.carregandoPromise = null;
        this.callbacks = []; // Para notificar quando carrega
    }

    onReady(callback) {
        if (this.carregado) {
            callback();
        } else {
            this.callbacks.push(callback);
        }
    }

    executarCallbacks() {
        this.callbacks.forEach(cb => {
            try {
                cb();
            } catch (error) {
                console.error('Erro ao executar callback:', error);
            }
        });
        this.callbacks = [];
    }

    async carregar() {
        // Se já está carregando, retornar a mesma promise
        if (this.carregandoPromise) {
            return this.carregandoPromise;
        }
        
        // Se já carregou, retornar benefícios
        if (this.carregado) {
            return this.beneficios;
        }
        
        // Iniciar carregamento
        this.carregandoPromise = this._carregarDaApi();
        
        try {
            await this.carregandoPromise;
            return this.beneficios;
        } finally {
            this.carregandoPromise = null;
        }
    }

    async recarregar() {
        // Invalidar cache e forçar recarregamento
        this.carregado = false;
        this.beneficios = [];
        this.carregandoPromise = null;
        
        console.log('🔄 Recarregando benefícios VIP...');
        return await this.carregar();
    }
    
    async _carregarDaApi() {
        try {
            const response = await fetch(`${API_URL}/beneficios`);
            if (!response.ok) throw new Error('Erro ao carregar benefícios');
            
            this.beneficios = await response.json();
            this.carregado = true;
            console.log('✓ Benefícios VIP carregados:', this.beneficios);
            
            // Notificar callbacks
            this.executarCallbacks();
            this.atualizarPrecos();
        } catch (error) {
            console.error('Erro ao carregar benefícios:', error);
            // Falhas não autorizam inventar um benefício que pode estar desativado no banco.
            this.beneficios = [];
            this.carregado = false;
            
            // Notificar a interface também quando a consulta falhar.
            this.executarCallbacks();
            this.atualizarPrecos();
        }
    }

    getBeneficioPorSlug(slug) {
        return this.beneficios.find(b => b.slug === slug && b.ativo !== false);
    }

    atualizarPrecos() {
        window.atualizarPrecosExibidos?.();
        window.authManager?.atualizarInterface();
    }

    calcularDesconto(preco, vipSlug) {
        const beneficio = vipSlug ? this.getBeneficioPorSlug(vipSlug) : null;
        try {
            return window.Precos.calcularCentavos(preco, beneficio) / 100;
        } catch (error) {
            if (error.code !== 'BENEFICIO_INVALIDO') throw error;
            return window.Precos.paraCentavos(preco) / 100;
        }
    }

    getNomeBeneficio(slug) {
        const beneficio = this.getBeneficioPorSlug(slug);
        return beneficio ? beneficio.nome : 'VIP';
    }

    getCorBeneficio(slug) {
        const beneficio = this.getBeneficioPorSlug(slug);
        return beneficio?.cor || '#6B1C40';
    }

    getBadgeHtml(slug) {
        const beneficio = this.getBeneficioPorSlug(slug);
        if (!beneficio) return '';
        
        const cor = window.RenderSeguro.cor(beneficio.cor);
        const nome = window.RenderSeguro.texto(beneficio.nome);
        
        // Calcular luminosidade da cor para decidir se usa texto preto ou branco
        const hex = cor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminosidade = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const corTexto = luminosidade > 0.5 ? '#000' : '#fff';
        
        const classe = typeof slug === 'string' && /^[a-z0-9_-]+$/i.test(slug) ? ` badge-${slug}` : '';
        return `<span class="badge-vip${classe}" style="background-color: ${cor}; color: ${corTexto};">${nome}</span>`;
    }

    getDescricaoDesconto(slug) {
        const beneficio = this.getBeneficioPorSlug(slug);
        if (!beneficio) return '';
        
        if (beneficio.tipo_desconto === 'percentual') {
            return `-${beneficio.valor_desconto}%`;
        } else {
            return `-R$ ${Number(beneficio.valor_desconto).toFixed(2).replace('.', ',')}`;
        }
    }

    async getBeneficiosParaSelect() {
        await this.carregar();
        return this.beneficios.map(b => ({
            value: b.slug,
            label: b.nome
        }));
    }

    async aguardarPronto() {
        // Aguarda até o VipManager estar carregado
        let tentativas = 0;
        while (!this.carregado && tentativas < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tentativas++;
        }
        return this.carregado;
    }
}

// Instância global
window.vipManager = new VipManager();

// Carregar benefícios assim que o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.vipManager.carregar().catch(err => console.error('Erro ao carregar VIP Manager:', err));
    });
} else {
    // Se o DOM já está pronto, carregar imediatamente
    window.vipManager.carregar().catch(err => console.error('Erro ao carregar VIP Manager:', err));
}

// Verificar mudanças nos benefícios a cada 30 segundos (detecção automática)
setInterval(async () => {
    if (document.hidden) return; // Não verificar se a aba está inativa
    
    try {
        const response = await fetch(`${API_URL}/beneficios`);
        if (!response.ok) return;
        
        const novosBeneficios = await response.json();
        
        // Verificar se houve mudanças
        if (JSON.stringify(novosBeneficios) !== JSON.stringify(window.vipManager.beneficios)) {
            console.log('🔄 Mudanças detectadas nos benefícios VIP, atualizando...');
            await window.vipManager.recarregar();
        }
    } catch (error) {
        // Silenciar erros de sincronização automática
    }
}, 30000);
