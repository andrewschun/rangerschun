/* Keep the ordinary Rangers website unchanged; add installation support on HTTPS. */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch(error => console.warn('Rangers installation support was not registered:', error));
  }, { once: true });
}
