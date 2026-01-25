// ===== MENU HAMBURGUER MOBILE =====
class MobileMenu {
    constructor() {
        this.menuToggle = null;
        this.nav = null;
        this.overlay = null;
        this.init();
    }

    init() {
        // Criar botão hamburguer se não existir
        this.createMenuToggle();
        
        // Criar overlay
        this.createOverlay();
        
        // Adicionar event listeners
        this.attachEvents();
        
        // Fechar menu ao redimensionar para desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                this.closeMenu();
            }
        });
    }

    createMenuToggle() {
        const header = document.querySelector('.header .container');
        if (!header) return;

        // Verificar se já existe
        this.menuToggle = document.querySelector('.menu-toggle');
        if (this.menuToggle) return;

        // Criar botão
        this.menuToggle = document.createElement('button');
        this.menuToggle.className = 'menu-toggle';
        this.menuToggle.setAttribute('aria-label', 'Toggle menu');
        this.menuToggle.setAttribute('aria-expanded', 'false');
        this.menuToggle.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        // Inserir antes do nav
        this.nav = document.querySelector('.nav');
        if (this.nav) {
            header.insertBefore(this.menuToggle, this.nav);
        }
    }

    createOverlay() {
        this.overlay = document.querySelector('.nav-overlay');
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'nav-overlay';
        document.body.appendChild(this.overlay);
    }

    attachEvents() {
        // Toggle menu
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', () => this.toggleMenu());
        }

        // Fechar ao clicar no overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeMenu());
        }

        // Fechar ao clicar em um link
        if (this.nav) {
            const navLinks = this.nav.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth < 768) {
                        this.closeMenu();
                    }
                });
            });
        }

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.nav?.classList.contains('active')) {
                this.closeMenu();
            }
        });

        // Prevenir scroll quando menu aberto
        this.preventScrollWhenMenuOpen();
    }

    toggleMenu() {
        const isOpen = this.nav?.classList.contains('active');
        if (isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        this.nav?.classList.add('active');
        this.overlay?.classList.add('active');
        this.menuToggle?.classList.add('active');
        this.menuToggle?.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    closeMenu() {
        this.nav?.classList.remove('active');
        this.overlay?.classList.remove('active');
        this.menuToggle?.classList.remove('active');
        this.menuToggle?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    preventScrollWhenMenuOpen() {
        // Prevenir scroll no iOS Safari
        let touchStartY = 0;
        
        this.nav?.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        this.nav?.addEventListener('touchmove', (e) => {
            const nav = this.nav;
            if (!nav) return;

            const touchY = e.touches[0].clientY;
            const scrollTop = nav.scrollTop;
            const scrollHeight = nav.scrollHeight;
            const height = nav.clientHeight;
            const delta = touchY - touchStartY;

            // Prevenir bounce scroll
            if (scrollTop === 0 && delta > 0) {
                e.preventDefault();
            } else if (scrollTop + height >= scrollHeight && delta < 0) {
                e.preventDefault();
            }
        }, { passive: false });
    }
}

// ===== TOUCH GESTURES (Swipe) =====
class TouchGestures {
    constructor(element, callbacks = {}) {
        this.element = element;
        this.callbacks = callbacks;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50;
        
        this.init();
    }

    init() {
        this.element.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.element.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
        this.element.addEventListener('touchend', () => this.handleTouchEnd(), { passive: true });
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }

    handleTouchMove(e) {
        this.touchEndX = e.touches[0].clientX;
        this.touchEndY = e.touches[0].clientY;
    }

    handleTouchEnd() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        
        // Detectar direção predominante
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Swipe horizontal
            if (Math.abs(deltaX) > this.minSwipeDistance) {
                if (deltaX > 0) {
                    this.callbacks.onSwipeRight?.();
                } else {
                    this.callbacks.onSwipeLeft?.();
                }
            }
        } else {
            // Swipe vertical
            if (Math.abs(deltaY) > this.minSwipeDistance) {
                if (deltaY > 0) {
                    this.callbacks.onSwipeDown?.();
                } else {
                    this.callbacks.onSwipeUp?.();
                }
            }
        }

        // Reset
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
    }
}

// ===== LAZY LOADING APRIMORADO =====
class LazyLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Usar Intersection Observer para lazy loading eficiente
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px' // Carregar 50px antes de entrar na tela
            });

            this.observeImages();
        } else {
            // Fallback para navegadores antigos
            this.loadAllImages();
        }
    }

    observeImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
            this.observer.observe(img);
        });
    }

    loadImage(img) {
        const src = img.dataset.src;
        const srcset = img.dataset.srcset;
        
        if (src) img.src = src;
        if (srcset) img.srcset = srcset;
        
        img.classList.add('loaded');
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
    }

    loadAllImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => this.loadImage(img));
    }
}

// ===== PERFORMANCE MONITORING =====
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.init();
    }

    init() {
        if ('PerformanceObserver' in window) {
            // Monitorar LCP (Largest Contentful Paint)
            this.observeLCP();
            
            // Monitorar FID (First Input Delay)
            this.observeFID();
            
            // Monitorar CLS (Cumulative Layout Shift)
            this.observeCLS();
        }

        // Log metrics quando página descarregar
        window.addEventListener('beforeunload', () => {
            this.logMetrics();
        });
    }

    observeLCP() {
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
            });
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
            console.warn('LCP observation not supported');
        }
    }

    observeFID() {
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    this.metrics.fid = entry.processingStart - entry.startTime;
                });
            });
            observer.observe({ entryTypes: ['first-input'] });
        } catch (e) {
            console.warn('FID observation not supported');
        }
    }

    observeCLS() {
        try {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                        this.metrics.cls = clsValue;
                    }
                }
            });
            observer.observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
            console.warn('CLS observation not supported');
        }
    }

    logMetrics() {
        console.log('📊 Performance Metrics:', {
            LCP: this.metrics.lcp ? `${Math.round(this.metrics.lcp)}ms` : 'N/A',
            FID: this.metrics.fid ? `${Math.round(this.metrics.fid)}ms` : 'N/A',
            CLS: this.metrics.cls ? this.metrics.cls.toFixed(3) : 'N/A'
        });

        // Enviar para analytics se configurado
        if (window.gtag) {
            Object.entries(this.metrics).forEach(([metric, value]) => {
                window.gtag('event', 'web_vitals', {
                    name: metric.toUpperCase(),
                    value: Math.round(value),
                    metric_id: metric
                });
            });
        }
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar menu mobile
    window.mobileMenu = new MobileMenu();
    
    // Inicializar lazy loading
    window.lazyLoader = new LazyLoader();
    
    // Inicializar performance monitoring
    if (window.location.hostname !== 'localhost') {
        window.performanceMonitor = new PerformanceMonitor();
    }
    
    // Exemplo: Adicionar swipe no grid de vinhos
    const vinhosGrid = document.querySelector('.vinhos-grid');
    if (vinhosGrid && window.innerWidth < 768) {
        new TouchGestures(vinhosGrid, {
            onSwipeLeft: () => console.log('Swipe left'),
            onSwipeRight: () => console.log('Swipe right')
        });
    }
});

// Exportar para uso global
window.TouchGestures = TouchGestures;
window.LazyLoader = LazyLoader;
