import { PT } from '../boot.js';
import { escapeHtml } from '../core/format.js';
import { iconSvg } from '../core/icons.js';

await PT.ready;
await PT.shellReady;

const STORE_KEY = 'missed';
const ROWS = [
  { key: 'fajr', label: 'morningPrayer' },
  { key: 'dhuhr', label: 'zuhr' },
  { key: 'asr', label: 'asr' },
  { key: 'maghrib', label: 'maghrib' },
  { key: 'ishaa', label: 'ishaa' },
  { key: 'witr', label: 'witr' },
  { key: 'fasting', label: 'fasting' },
];

const list = document.getElementById('missed-list');

const stored = await PT.storage.get(STORE_KEY, {});
const data = {
  fajr: Number(stored?.fajr || 0),
  dhuhr: Number(stored?.dhuhr || 0),
  asr: Number(stored?.asr || 0),
  maghrib: Number(stored?.maghrib || 0),
  ishaa: Number(stored?.ishaa || 0),
  witr: Number(stored?.witr || 0),
  fasting: Number(stored?.fasting || 0),
  updatedAt: Number(stored?.updatedAt || 0),
};

async function save() {
  data.updatedAt = Date.now();
  await PT.storage.set(STORE_KEY, data);
}

function setValue(key, value, input) {
  const next = Math.max(0, Math.floor(Number(value) || 0));
  data[key] = next;
  if (input) input.value = String(next);
  save();
}

function renderRows() {
  list.innerHTML = ROWS.map(({ key, label }) => `
    <div class="missed-row" data-row="${key}">
      <div class="missed-row__title">${escapeHtml(PT.i18n.t(label))}</div>
      <button class="missed-btn" type="button" data-minus aria-label="${escapeHtml(PT.i18n.t(label))} -1">${iconSvg('minus-circle', { size: 34 })}</button>
      <input class="missed-row__value" type="number" min="0" step="1" inputmode="numeric" value="${data[key]}" aria-label="${escapeHtml(PT.i18n.t(label))}">
      <button class="missed-btn" type="button" data-plus aria-label="${escapeHtml(PT.i18n.t(label))} +1">${iconSvg('plus-circle', { size: 34 })}</button>
    </div>
  `).join('');

  list.querySelectorAll('.missed-row').forEach((row) => {
    const key = row.dataset.row;
    const input = row.querySelector('.missed-row__value');
    row.querySelector('[data-minus]')?.addEventListener('click', () => setValue(key, data[key] - 1, input));
    row.querySelector('[data-plus]')?.addEventListener('click', () => setValue(key, data[key] + 1, input));
    input?.addEventListener('change', () => setValue(key, input.value, input));
    input?.addEventListener('blur', () => setValue(key, input.value, input));
  });
}

renderRows();
