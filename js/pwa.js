if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(err => console.error('SW registro falhou:', err));
    });
}

window.desativarPushDispositivo = () => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(async registro => {
        registro?.active?.postMessage({ tipo: 'PUSH_PREFERENCIA', ativo: false });
        const inscricao = await registro?.pushManager?.getSubscription();
        await inscricao?.unsubscribe();
    }).catch(() => {});
};
