/* Enregistre le service worker (hors ligne) et propose la mise à jour sans jamais recharger de force. */
(() => {
  if (!('serviceWorker' in navigator) || !/^https:$|^http:$/.test(location.protocol)) return;
  const insecure = location.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (insecure) return;

  function offerUpdate(worker) {
    if (document.getElementById('pwa-update')) return;
    const bar = document.createElement('div');
    bar.id = 'pwa-update';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9999;display:flex;gap:12px;align-items:center;padding:8px 8px 8px 16px;border-radius:12px;background:#1d2733;color:#fff;font:500 14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:calc(100vw - 32px)';
    const text = document.createElement('span'); text.textContent = 'Une nouvelle version est disponible.';
    const go = document.createElement('button'); go.type = 'button'; go.textContent = 'Mettre à jour';
    go.style.cssText = 'min-height:44px;padding:0 16px;border:0;border-radius:8px;background:#2457c5;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer';
    const later = document.createElement('button'); later.type = 'button'; later.textContent = '×'; later.setAttribute('aria-label', 'Plus tard');
    later.style.cssText = 'min-width:44px;min-height:44px;border:0;border-radius:8px;background:transparent;color:#fff;font:400 22px system-ui,sans-serif;cursor:pointer';
    go.addEventListener('click', () => { go.disabled = true; worker.postMessage({ type: 'SKIP_WAITING' }); });
    later.addEventListener('click', () => bar.remove());
    bar.append(text, go, later);
    document.body.append(bar);
  }

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !sessionStorageFlag()) return;
    reloading = true;
    location.reload();
  });
  // Ne recharge que si l'utilisateur vient de demander la mise à jour (pas à la première installation).
  let asked = false;
  function sessionStorageFlag() { return asked; }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const watch = (w) => w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
      });
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
      document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#pwa-update button:not([aria-label])')) asked = true; }, true);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    } catch (err) {
      console.warn('Service worker non enregistré :', err);
    }
  });
})();
