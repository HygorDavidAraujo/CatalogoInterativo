// Configuração centralizada da aplicação

// Determinar URL da API baseado no ambiente
const getApiUrl = () => {
    // Em produção (Railway)
    if (window.location.hostname.includes('railway.app')) {
        return window.location.origin;
    }
    
    // Em desenvolvimento local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    
    // Fallback para o domínio atual
    return window.location.origin;
};

// Configurações da aplicação
const CONFIG = {
    API_URL: getApiUrl(),
    
    // Paginação
    ITEMS_PER_PAGE: 12,
    ADMIN_ITEMS_PER_PAGE: 20,
    
    // Cloudinary
    CLOUDINARY_TRANSFORMS: {
        thumbnail: 'c_fill,w_300,h_300,q_auto,f_auto',
        card: 'c_fill,w_400,h_400,q_auto,f_auto',
        detail: 'c_fit,w_800,h_800,q_auto,f_auto',
        admin: 'c_fill,w_80,h_80,q_auto,f_auto'
    },
    
    // Timeouts
    FETCH_TIMEOUT: 30000, // 30 segundos
    
    // Mensagens
    MESSAGES: {
        LOADING: 'Carregando...',
        ERROR_GENERIC: 'Ocorreu um erro. Tente novamente.',
        ERROR_NETWORK: 'Erro de conexão. Verifique sua internet.',
        SUCCESS_SAVE: 'Salvo com sucesso!',
        SUCCESS_DELETE: 'Excluído com sucesso!',
        SUCCESS_UPDATE: 'Atualizado com sucesso!'
    }
};

// Função para otimizar URLs do Cloudinary
const optimizeCloudinaryUrl = (url, transform = 'card') => {
    if (!url || !url.includes('cloudinary.com')) {
        return url;
    }
    
    const transformation = CONFIG.CLOUDINARY_TRANSFORMS[transform];
    if (!transformation) {
        return url;
    }
    
    // Inserir transformação na URL
    return url.replace('/upload/', `/upload/${transformation}/`);
};

// Função helper para fetch com timeout
const fetchWithTimeout = async (url, options = {}, timeout = CONFIG.FETCH_TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout: Requisição demorou muito');
        }
        throw error;
    }
};

// Exportar para uso global
window.APP_CONFIG = CONFIG;
window.optimizeCloudinaryUrl = optimizeCloudinaryUrl;
window.fetchWithTimeout = fetchWithTimeout;

console.log('✓ Configuração carregada:', CONFIG);
