import { PT } from '../boot.js';
import { formatGregorian, formatHijri } from '../core/format.js';
import { confirmAction, showToast } from '../components/ui.js';

await PT.ready;
await PT.shellReady;

const DATE_PATTERNS = [
  'DD MMM YYYY',
  'DD MMM YY',
  'DD.MM.YYYY',
  'DD.MM.YY',
  'DD/MM/YYYY',
  'DD/MM/YY',
  'DD MM YYYY',
  'DD MM YY',
  'DD MMM',
  'DD.MM',
  'DD/MM',
  'DD MM',
];

function fillFormatSelects() {
  document.querySelectorAll('[data-format-select]').forEach((select) => {
    const hijri = select.dataset.formatSelect === 'hijri';
    select.innerHTML = DATE_PATTERNS.map((pattern) => {
      const label = hijri
        ? formatHijri({ year: 1448, month: 6, day: 11 }, pattern, { i18n: PT.i18n, numbers: PT.settings.get('numbers') })
        : formatGregorian('2026-11-20', pattern, { i18n: PT.i18n, numbers: PT.settings.get('numbers') });
      return `<option value="${pattern}">${label}</option>`;
    }).join('');
  });
}

function fillOffsetSelect() {
  const select = document.querySelector('[data-setting="hijri_day_offset"]');
  if (!select) return;
  select.innerHTML = [-3, -2, -1, 0, 1, 2, 3]
    .map((value) => `<option value="${value}">${value > 0 ? `+${value}` : value}</option>`)
    .join('');
}

function setControls() {
  document.querySelectorAll('[data-setting]').forEach((control) => {
    const key = control.dataset.setting;
    const value = PT.settings.get(key);
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = String(value ?? '');
  });
}

async function saveControl(control) {
  const key = control.dataset.setting;
  let value;
  if (control.type === 'checkbox') value = control.checked;
  else if (control.type === 'number' || key === 'vibration' || key === 'hijri_day_offset') value = Number(control.value);
  else value = control.value;

  if (key === 'language') {
    await PT.settings.set('language', value);
    await PT.i18n.setLanguage(value);
    return;
  }
  if (key === 'theme') {
    await PT.theme.set(value);
    showToast(PT.i18n.t('web.settingsSaved'));
    return;
  }
  await PT.settings.set(key, value);
  showToast(PT.i18n.t('web.settingsSaved'));
}

fillFormatSelects();
fillOffsetSelect();
setControls();

const ARIA_LABELS = {
  language: 'language',
  theme: 'web.theme',
  numbers: 'web.numbers',
  use12h: 'use12h',
  dateformat: 'dateFormat',
  hdateformat: 'hdateFormat',
  hijri_calculation: 'hijriCalculation',
  hijri_day_offset: 'hijriDayOffset',
  vakit_indicator: 'vakit_indicator',
  kerahat_sunrise: 'kerahatSun',
  kerahat_istiva: 'kerahatIstiwa',
  kerahat_sunset: 'kerahatMaghrib',
  vibration: 'web.vibration',
};

document.querySelectorAll('[data-setting]').forEach((control) => {
  const labelKey = ARIA_LABELS[control.dataset.setting];
  if (labelKey) control.setAttribute('aria-label', PT.i18n.t(labelKey));
  control.addEventListener('change', () => saveControl(control));
});

const installGroup = document.getElementById('install-group');
const installButton = document.getElementById('install-app');
function showInstall() {
  if (installGroup) installGroup.hidden = !PT.installPrompt;
}
window.addEventListener('pt:installable', showInstall);
showInstall();
installButton?.addEventListener('click', async () => {
  if (!PT.installPrompt) return;
  PT.installPrompt.prompt();
  await PT.installPrompt.userChoice;
  PT.installPrompt = null;
  if (installGroup) installGroup.hidden = true;
});

document.getElementById('reset-data')?.addEventListener('click', async () => {
  const ok = await confirmAction({
    title: PT.i18n.t('web.resetData'),
    message: PT.i18n.t('web.resetDataConfirm'),
    confirmText: PT.i18n.t('web.resetData'),
  });
  if (!ok) return;
  for (const key of await PT.storage.keys()) {
    if (key.startsWith('times:') || key.startsWith('city:')) await PT.storage.remove(key);
  }
  await PT.cities.store.reset();
  await PT.dhikr.store.reset();
  await PT.settings.reset();
  try { localStorage.removeItem('pt.theme'); } catch { /* ignore */ }
  window.location.reload();
});
