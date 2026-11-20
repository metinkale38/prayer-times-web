import { PT } from '../boot.js';
import { shareOrCopy } from '../components/ui.js';

await PT.ready;
await PT.shellReady;

const version = document.getElementById('about-version');
if (version) version.textContent = PT.config.APP_VERSION;

const storage = document.getElementById('about-storage');
if (storage) {
  const names = {
    'local-storage': PT.i18n.t('web.storageLocal'),
    'android-bridge': PT.i18n.t('web.storageAndroid'),
    memory: PT.i18n.t('web.storageMemory'),
  };
  storage.textContent = names[PT.storage.adapterName] || PT.storage.adapterName;
}

document.getElementById('about-share')?.addEventListener('click', async () => {
  await shareOrCopy({
    title: PT.i18n.t('appName'),
    text: PT.i18n.t('web.aboutText'),
    url: location.href.replace(/about\.html.*$/, 'index.html'),
  });
});
