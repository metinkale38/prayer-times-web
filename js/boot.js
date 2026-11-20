import { createStorage } from './core/storage.js';
import { initSettings } from './core/settings.js';
import { initI18n } from './core/i18n.js';
import { initTheme } from './core/theme.js';
import { createHttp } from './core/http.js';
import { hydrateIcons } from './core/icons.js';
import * as format from './core/format.js';
import * as config from './core/config.js';
import * as qibla from './services/qibla.js';
import { ApiService } from './services/api.js';
import { CitiesService } from './services/cities.js';
import { TimesService } from './services/times.js';
import { DhikrService } from './services/dhikr.js';
import { HijriService } from './services/hijri.js';

const params = new URLSearchParams(window.location.search);
if (params.get('embed') === '1') document.body.dataset.embed = 'true';

const storage = createStorage();
const settings = await initSettings(storage);
const langOverride = params.get('lang');
const i18n = await initI18n(settings, langOverride);
const theme = await initTheme(settings);

const themeOverride = params.get('theme');
if (themeOverride && ['system', 'light', 'dark'].includes(themeOverride)) {
  theme.mode = themeOverride;
  theme.apply();
}

const http = createHttp();
const api = new ApiService(http);
const cities = await new CitiesService({ storage, settings, api }).ready();
const dhikr = await new DhikrService({ storage, i18n }).ready();
const hijri = await new HijriService({ i18n, settings }).ready();
const times = new TimesService({ storage, api, settings, i18n });

let resolveShell = null;
const hasShell = Boolean(document.querySelector('app-shell'));
const shellReady = hasShell
  ? new Promise((resolve) => { resolveShell = resolve; })
  : Promise.resolve();

const PT = {
  storage,
  settings,
  i18n,
  theme,
  http,
  api,
  cities,
  dhikr,
  hijri,
  times,
  config,
  format,
  qibla,
  shellReady,
  resolveShell,
  ready: Promise.resolve(),
};

window.PT = PT;

hydrateIcons(document);
i18n.apply(document);

window.dispatchEvent(new CustomEvent('pt:ready', { detail: PT }));

export { PT };
export default PT;
