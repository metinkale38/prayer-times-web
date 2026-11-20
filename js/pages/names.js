import { PT } from '../boot.js';
import { escapeHtml } from '../core/format.js';

await PT.ready;
await PT.shellReady;

const grid = document.getElementById('names-grid');
const empty = document.getElementById('names-empty');
const searchWrap = document.getElementById('names-search');
const queryInput = document.getElementById('names-query');
const searchToggle = document.getElementById('names-search-toggle');
const searchClose = document.getElementById('names-search-close');

let names = [];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .toLowerCase();
}

function cardFor(item) {
  const lang = PT.i18n.lang;
  const name = item.name?.[lang] || item.name?.en || '';
  const meaning = item.meaning?.[lang] || item.meaning?.en || '';
  if (item.no === 1) {
    return `
      <article class="name-card name-card--first">
        <img class="name-card__image" src="./assets/img/allah.png" alt="" width="220" height="243">
        <div class="name-card__arabic" lang="ar" dir="rtl">${escapeHtml(item.ar)}</div>
        <div class="name-card__meaning">${escapeHtml(meaning)}</div>
      </article>
    `;
  }
  return `
    <article class="name-card">
      <div class="name-card__name">${escapeHtml(name)}</div>
      <div class="name-card__arabic" lang="ar" dir="rtl">${escapeHtml(item.ar)}</div>
      <div class="name-card__meaning">${escapeHtml(meaning)}</div>
    </article>
  `;
}

function render() {
  const query = normalize(queryInput?.value || '');
  const filtered = names.filter((item) => {
    if (!query) return true;
    const haystack = normalize([
      item.ar,
      item.name?.en,
      item.name?.[PT.i18n.lang],
      item.meaning?.en,
      item.meaning?.[PT.i18n.lang],
    ].join(' '));
    return haystack.includes(query);
  });

  grid.innerHTML = filtered.map((item) => cardFor(item)).join('');
  grid.hidden = filtered.length === 0;
  empty.hidden = filtered.length !== 0;
  if (!filtered.length) {
    empty.innerHTML = `<p>${escapeHtml(PT.i18n.t('web.noResults'))}</p>`;
  }
}

async function load() {
  grid.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>${escapeHtml(PT.i18n.t('web.loading'))}</span></div>`;
  try {
    const response = await fetch(new URL('../../data/names.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    names = data.names || [];
    render();
  } catch (error) {
    console.warn('[names] load failed', error);
    grid.innerHTML = `<div class="names-empty"><p>${escapeHtml(PT.i18n.t('web.error'))}</p></div>`;
  }
}

function toggleSearch(force) {
  const open = force ?? searchWrap.hidden;
  searchWrap.classList.toggle('is-open', open);
  searchWrap.hidden = !open;
  if (open) {
    queryInput.value = '';
    render();
    requestAnimationFrame(() => queryInput.focus());
  }
}

searchToggle?.addEventListener('click', () => toggleSearch());
searchClose?.addEventListener('click', () => toggleSearch(false));
queryInput?.addEventListener('input', render);

load();
