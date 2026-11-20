if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(err => console.error('SW registro falhou:', err));
    });
}

window.suspenderPushDispositivo = () => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(registro => {
        registro?.active?.postMessage({ tipo: 'PUSH_PREFERENCIA', ativo: false });
    }).catch(() => {});
};

// Compatibilidade com versões do auth.js ainda presentes no cache do navegador.
window.desativarPushDispositivo = window.suspenderPushDispositivo;
