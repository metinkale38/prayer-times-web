import { PT } from '../boot.js';
import { escapeHtml, formatTime, isoDateInZone } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { apiErrorMessage } from '../services/api.js';
import { closeDialog, openDialog, showToast } from './ui.js';

let dialog = null;
let state = { city: null, year: 0, month: 0 };

const COLUMNS = [
  { label: 'fajr', data: 'fajr' },
  { label: 'sun', data: 'sun' },
  { label: 'zuhr', data: 'dhuhr' },
  { label: 'asr', data: 'asr' },
  { label: 'maghrib', data: 'maghrib' },
  { label: 'ishaa', data: 'ishaa' },
];

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'month-sheet';
  dialog.innerHTML = `
    <div class="month-sheet__head">
      <button class="icon-btn" type="button" data-prev aria-label="${escapeHtml(PT.i18n.t('web.previousMonth'))}">${iconSvg('chevron-left')}</button>
      <div class="month-sheet__title" data-title></div>
      <button class="icon-btn" type="button" data-next aria-label="${escapeHtml(PT.i18n.t('web.nextMonth'))}">${iconSvg('chevron-right')}</button>
      <button class="icon-btn" type="button" data-sync aria-label="${escapeHtml(PT.i18n.t('web.sync'))}">${iconSvg('refresh')}</button>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="month-sheet__body" data-body></div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-close]').addEventListener('click', () => closeDialog(dialog));
  dialog.querySelector('[data-sync]').addEventListener('click', sync);
  dialog.querySelector('[data-prev]').addEventListener('click', () => shiftMonth(-1));
  dialog.querySelector('[data-next]').addEventListener('click', () => shiftMonth(1));
  return dialog;
}

async function render() {
  if (!dialog || !state.city) return;
  const { city, year, month } = state;
  const title = dialog.querySelector('[data-title]');
  const body = dialog.querySelector('[data-body]');
  title.textContent = `${PT.i18n.monthName(month)} ${year}`;
  body.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>${escapeHtml(PT.i18n.t('web.loading'))}</span></div>`;

  try {
    const { days } = await PT.times.getMonth(city, year, month);
    if (!days.length) {
      body.innerHTML = `
        <div class="month-sheet__empty">
          <p>${escapeHtml(PT.i18n.t('web.monthNoData'))}</p>
          <button class="btn" type="button" data-empty-sync>${escapeHtml(PT.i18n.t('web.sync'))}</button>
        </div>
      `;
      body.querySelector('[data-empty-sync]')?.addEventListener('click', sync);
      return;
    }

    const settings = PT.settings;
    const numbers = settings.get('numbers', 'normal');
    const use12h = settings.get('use12h', false);
    const today = isoDateInZone(new Date(), city.timezone);
    const labels = COLUMNS.map((col) => PT.i18n.t(col.label === 'fajr' && PT.i18n.lang === 'tr' ? 'imsak' : col.label));
    const header = `<div class="month-table__head-row">${['', ...labels].map((label) => `<div class="month-table__header">${escapeHtml(label)}</div>`).join('')}</div>`;
    const rows = days.map((day) => {
      const adjusted = PT.times.adjustedDay(city, day);
      const times = COLUMNS.map((col) => formatTime(adjusted[col.data], { use12h, numbers, i18n: PT.i18n }));
      const date = `${day.date.slice(8, 10)}.${day.date.slice(5, 7)}`;
      return `
        <div class="month-table__row ${day.date === today ? 'month-table__row--today' : ''}">
          <div class="month-table__date">${escapeHtml(date)}</div>
          ${times.map((time) => `<div>${escapeHtml(time)}</div>`).join('')}
        </div>
      `;
    }).join('');
    body.innerHTML = `<div class="month-table">${header}${rows}</div>`;
  } catch (error) {
    body.innerHTML = `<div class="month-sheet__empty">${escapeHtml(apiErrorMessage(error, PT.i18n))}</div>`;
  }
}

function shiftMonth(delta) {
  if (!state.city) return;
  let month = state.month + delta;
  let year = state.year;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  state.month = month;
  state.year = year;
  render();
}

async function sync() {
  if (!state.city) return;
  try {
    showToast(PT.i18n.t('web.loading'), { duration: 1200 });
    await PT.times.getTimes(state.city, { force: true });
    await render();
    showToast(PT.i18n.t('web.synced'));
  } catch (error) {
    showToast(apiErrorMessage(error, PT.i18n));
  }
}

export function openMonthView(city, cache) {
  if (!dialog) build();
  const today = isoDateInZone(new Date(), city.timezone);
  state = {
    city,
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
  render();
  openDialog(dialog);
}
