import { PT } from './boot.js';
import './components/app-shell.js';
import { closeDialog } from './components/ui.js';

const PAGE_TITLE_KEYS = {
  times: 'appName',
  compass: 'compass',
  names: 'names',
  dhikr: 'dhikr',
  calendar: 'calendar',
  missed: 'missedPrayers',
  settings: 'settings',
  about: 'about',
};

const pageTitleKey = PAGE_TITLE_KEYS[document.body.dataset.page];
if (pageTitleKey) {
  const appName = PT.i18n.t('appName');
  const title = PT.i18n.t(pageTitleKey);
  document.title = title === appName ? appName : `${title} · ${appName}`;
}

document.addEventListener('click', (event) => {
  const closer = event.target.closest('[data-close]');
  if (!closer) return;
  const dialog = closer.closest('dialog');
  if (dialog) closeDialog(dialog);
});

// htmx is only used for real HTML fragments (holiday articles, about credits).
// Page navigation intentionally stays a normal multi-page navigation so every
// page's ES module is initialised exactly once.
document.body.addEventListener('htmx:responseError', (event) => {
  console.warn('[htmx] request failed', event.detail);
});

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed', error);
    });
  };
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  PT.installPrompt = event;
  window.dispatchEvent(new Event('pt:installable'));
});
