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
                { slug: 'prata', nome: 'VIP Prata', tipo_desconto: 'percentual', valor_desconto: 3 },
                { slug: 'ouro', nome: 'VIP Ouro', tipo_desconto: 'percentual', valor_desconto: 7 },
                { slug: 'diamante', nome: 'VIP Diamante', tipo_desconto: 'percentual', valor_desconto: 11 }
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
