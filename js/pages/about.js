import { PT } from '../boot.js';
import { shareOrCopy } from '../components/ui.js';

await PT.ready;
await PT.shellReady;

const version = document.getElementById('about-version');
if (version) version.textContent = PT.config.APP_VERSION;

document.getElementById('about-share')?.addEventListener('click', async () => {
  await shareOrCopy({
    title: PT.i18n.t('appName'),
    text: PT.i18n.t('web.aboutText'),
    url: location.href.replace(/about\.html.*$/, 'index.html'),
  });
});
