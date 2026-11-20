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
        thumbnail: 'c_fit,w_300,h_300,q_auto,f_auto',
        card: 'c_fit,w_400,h_400,q_auto,f_auto',
        detail: 'c_fit,w_800,h_800,q_auto,f_auto',
        admin: 'c_fit,w_80,h_80,q_auto,f_auto'
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

// Remove somente os tamanhos que a própria aplicação acrescentou. Preserva
// recortes, marcas d'água e outras transformações cadastradas deliberadamente.
const getOriginalCloudinaryUrl = value => {
    if (typeof value !== 'string') return value;
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'res.cloudinary.com') return value;
        const marker = '/image/upload/';
        const index = url.pathname.indexOf(marker);
        if (index < 0) return value;
        const prefix = url.pathname.slice(0, index + marker.length);
        const parts = url.pathname.slice(prefix.length).split('/');
        // URLs assinadas não podem ser reescritas sem invalidar a assinatura.
        if (parts[0].startsWith('s--')) return value;
        const tamanhos = Object.values(CONFIG.CLOUDINARY_TRANSFORMS);
        while (tamanhos.includes(parts[0])) parts.shift();
        url.pathname = prefix + parts.join('/');
        return url.href;
    } catch (_) {
        return value;
    }
};

// A otimização pode ser chamada várias vezes sem acumular redimensionamentos.
const optimizeCloudinaryUrl = (url, transform = 'card') => {
    const transformation = CONFIG.CLOUDINARY_TRANSFORMS[transform];
    if (!transformation || typeof url !== 'string') return url;
    try {
        const original = new URL(getOriginalCloudinaryUrl(url));
        if (!['http:', 'https:'].includes(original.protocol) || original.hostname !== 'res.cloudinary.com' ||
            !original.pathname.includes('/image/upload/') || /\/image\/upload\/s--/.test(original.pathname)) return url;
        original.pathname = original.pathname.replace('/image/upload/', `/image/upload/${transformation}/`);
        return original.href;
    } catch (_) {
        return url;
    }
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
window.getOriginalCloudinaryUrl = getOriginalCloudinaryUrl;
window.fetchWithTimeout = fetchWithTimeout;

console.log('✓ Configuração carregada:', CONFIG);
