import { PT } from '../boot.js';
import { escapeHtml, formatGregorian, formatHijri } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { closeDialog, openDialog } from '../components/ui.js';

await PT.ready;
await PT.shellReady;

const yearTabs = document.getElementById('year-tabs');
const list = document.getElementById('calendar-list');
const switchButton = document.getElementById('calendar-switch');

const params = new URLSearchParams(location.search);
let type = params.get('type') === 'greg' ? 'greg' : 'hijri';
let year = Number(params.get('year') || 0);
let articleDialog = null;
let articleBody = null;

function currentHijriYear() {
  const today = new Date().toISOString().slice(0, 10);
  return PT.hijri.toHijri(today).year;
}

function currentGregYear() {
  return new Date().getFullYear();
}

if (!year) year = type === 'hijri' ? currentHijriYear() : currentGregYear();

function setUrl() {
  history.replaceState(null, '', `${location.pathname}?type=${type}&year=${year}`);
}

function yearRange(center) {
  return [center - 2, center - 1, center, center + 1, center + 2];
}

function renderTabs() {
  const years = yearRange(year);
  yearTabs.innerHTML = years.map((value) => `
    <button class="year-tab" type="button" role="tab" aria-selected="${value === year}" data-year="${value}">${escapeHtml(PT.i18n.number(value, PT.settings.get('numbers', 'normal')))}</button>
  `).join('');
  yearTabs.querySelectorAll('[data-year]').forEach((button) => {
    button.addEventListener('click', () => {
      year = Number(button.dataset.year);
      setUrl();
      render();
    });
  });
}

function monthHeader(dateISO, hijri, label) {
  return `
    <div class="calendar-event calendar-event--month" role="presentation">
      <div class="calendar-event__main">
        <div>${escapeHtml(label)}</div>
      </div>
      <div class="calendar-event__dates">${escapeHtml(formatGregorian(dateISO, 'DD MMM YYYY', { i18n: PT.i18n, numbers: PT.settings.get('numbers', 'normal') }))}</div>
    </div>
  `;
}

function eventRow(entry) {
  if (entry.key === 'MONTH') {
    const label = `${String(entry.hijri.day).padStart(2, '0')} ${PT.i18n.monthName(entry.hijri.month, true)} ${entry.hijri.year}`;
    return monthHeader(entry.date, entry.hijri, label);
  }
  if (entry.key === 'GREG_MONTH') {
    const label = `${PT.i18n.monthName(entry.gregMonth, false)} ${entry.gregYear}`;
    return monthHeader(entry.date, entry.hijri, label);
  }

  const key = PT.hijri.eventNameKey(entry.key);
  if (!key) return '';
  const title = PT.i18n.t(key);
  const article = PT.hijri.articleFile(entry.key);
  const canOpen = article && (PT.i18n.lang === 'de' || PT.i18n.lang === 'tr');
  return `
    <button class="calendar-event" type="button" ${canOpen ? `data-article="${article}"` : 'disabled'} aria-label="${escapeHtml(title)}">
      <div class="calendar-event__main">
        <div class="calendar-event__title">${escapeHtml(title)}</div>
        <div class="calendar-event__dates">
          <span>${escapeHtml(formatHijri(entry.hijri, 'DD MMM YYYY', { i18n: PT.i18n, numbers: PT.settings.get('numbers', 'normal') }))}</span>
          <span>${escapeHtml(formatGregorian(entry.date, 'DD MMM YYYY', { i18n: PT.i18n, numbers: PT.settings.get('numbers', 'normal') }))}</span>
        </div>
      </div>
      ${canOpen ? `<span class="calendar-event__chevron">${iconSvg('chevron-right')}</span>` : ''}
    </button>
  `;
}

async function render() {
  renderTabs();
  list.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>${escapeHtml(PT.i18n.t('web.loading'))}</span></div>`;
  try {
    let entries;
    if (type === 'hijri') {
      entries = await PT.hijri.eventsForHijriYear(year);
    } else {
      const events = await PT.hijri.eventsForGregYear(year);
      const months = [];
      for (let month = 1; month <= 12; month += 1) {
        const date = `${year}-${String(month).padStart(2, '0')}-01`;
        months.push({ date, hijri: PT.hijri.toHijri(date), key: 'GREG_MONTH', gregYear: year, gregMonth: month });
      }
      entries = [...events.filter((e) => e.key !== 'MONTH'), ...months];
    }
    const isHeader = (entry) => entry.key === 'MONTH' || entry.key === 'GREG_MONTH';
    entries.sort((a, b) => a.date.localeCompare(b.date) || (isHeader(a) ? -1 : isHeader(b) ? 1 : 0));
    list.innerHTML = entries.map(eventRow).join('');
    list.querySelectorAll('[data-article]').forEach((button) => {
      button.addEventListener('click', () => openArticle(button.dataset.article));
    });
  } catch (error) {
    console.warn('[calendar] render failed', error);
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(PT.i18n.t('web.error'))}</p></div>`;
  }
}

function buildArticleDialog() {
  if (articleDialog) return;
  articleDialog = document.createElement('dialog');
  articleDialog.className = 'modal';
  articleDialog.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${escapeHtml(PT.i18n.t('web.eventDetails'))}</div>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="modal__body">
      <div data-article-body></div>
    </div>
  `;
  document.body.appendChild(articleDialog);
  articleBody = articleDialog.querySelector('[data-article-body]');
  articleDialog.querySelector('[data-close]').addEventListener('click', () => closeDialog(articleDialog));
  articleDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(articleDialog); });
}

async function openArticle(file) {
  buildArticleDialog();
  const lang = PT.i18n.lang === 'tr' ? 'tr' : 'de';
  const url = `./partials/calendar/${lang}/${file}.html`;
  const content = document.createElement('div');
  content.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>${escapeHtml(PT.i18n.t('web.loading'))}</span></div>`;
  articleBody.replaceChildren(content);
  openDialog(articleDialog);

  // htmx is used for the real HTML fragment. The fetch fallback keeps the
  // page functional if htmx is unavailable or the fragment cannot be swapped.
  if (window.htmx) {
    content.setAttribute('hx-get', url);
    content.setAttribute('hx-trigger', 'load');
    content.setAttribute('hx-target', 'this');
    content.setAttribute('hx-swap', 'innerHTML');
    content.addEventListener('htmx:responseError', () => loadArticleFallback(url, content), { once: true });
    window.htmx.process(content);
  } else {
    await loadArticleFallback(url, content);
  }
}

async function loadArticleFallback(url, target = articleBody) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    target.innerHTML = await response.text();
  } catch (error) {
    console.warn('[calendar] article failed', error);
    target.innerHTML = `<p class="muted">${escapeHtml(PT.i18n.t('web.noEventDetails'))}</p>`;
  }
}

switchButton?.addEventListener('click', () => {
  type = type === 'hijri' ? 'greg' : 'hijri';
  year = type === 'hijri' ? currentHijriYear() : currentGregYear();
  setUrl();
  render();
});

setUrl();
render();

window.addEventListener('pt:themechange', () => {
  // Re-render so the custom calendar article chrome picks up the new theme.
  list.querySelectorAll('.calendar-event').forEach((el) => {
    el.style.color = 'var(--fg)';
  });
});
