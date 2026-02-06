// ===== GERENCIADOR DE BENEFÍCIOS VIP =====
class VipManager {
    constructor() {
        this.beneficios = [];
        this.carregado = false;
        this.carregandoPromise = null;
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
        } catch (error) {
            console.error('Erro ao carregar benefícios:', error);
            // Fallback para benefícios padrão em caso de erro
            this.beneficios = [
                { slug: 'prata', nome: 'VIP Prata', tipo_desconto: 'percentual', valor_desconto: 3, cor: '#C0C0C0' },
                { slug: 'ouro', nome: 'VIP Ouro', tipo_desconto: 'percentual', valor_desconto: 7, cor: '#FFD700' },
                { slug: 'diamante', nome: 'VIP Diamante', tipo_desconto: 'percentual', valor_desconto: 11, cor: '#B9F2FF' }
            ];
            this.carregado = true;
            console.log('⚠ Usando benefícios padrão (fallback)');
        }
    }

    getBeneficioPorSlug(slug) {
        return this.beneficios.find(b => b.slug === slug);
    }

    calcularDesconto(preco, vipSlug) {
        if (!vipSlug) return preco;
        
        const beneficio = this.getBeneficioPorSlug(vipSlug);
        if (!beneficio) return preco;

        let precoFinal = preco;
        
        if (beneficio.tipo_desconto === 'percentual') {
            // Desconto percentual
            const desconto = parseFloat(beneficio.valor_desconto) / 100;
            precoFinal = preco * (1 - desconto);
        } else if (beneficio.tipo_desconto === 'valor_fixo') {
            // Desconto em valor fixo
            precoFinal = preco - parseFloat(beneficio.valor_desconto);
        }

        // Garantir que o preço não fique negativo
        precoFinal = Math.max(0, precoFinal);
        
        // Arredondar para cima e adicionar .90
        precoFinal = Math.ceil(precoFinal * 100) / 100;
        precoFinal = Math.floor(precoFinal) + 0.90;

        return precoFinal;
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
        
        const cor = beneficio.cor || '#6B1C40';
        const nome = beneficio.nome;
        
        // Calcular luminosidade da cor para decidir se usa texto preto ou branco
        const hex = cor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminosidade = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const corTexto = luminosidade > 0.5 ? '#000' : '#fff';
        
        return `<span class="badge-vip badge-${slug}" style="background-color: ${cor}; color: ${corTexto};">${nome}</span>`;
    }

    getDescricaoDesconto(slug) {
        const beneficio = this.getBeneficioPorSlug(slug);
        if (!beneficio) return '';
        
        if (beneficio.tipo_desconto === 'percentual') {
            return `-${beneficio.valor_desconto}%`;
        } else {
            return `-R$ ${beneficio.valor_desconto.toFixed(2).replace('.', ',')}`;
        }
    }

    async getBeneficiosParaSelect() {
        await this.carregar();
        return this.beneficios.map(b => ({
            value: b.slug,
            label: b.nome
        }));
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
