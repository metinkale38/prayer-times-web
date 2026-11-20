import { PT } from '../boot.js';
import { escapeHtml, fitTexts } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { createCityCard, updateCityCard, updateCityCardLive } from '../components/city-card.js';
import { openCitySearch } from '../components/city-search.js';
import { openMonthView } from '../components/month-view.js';
import { setDocumentTitle } from '../components/ui.js';

await PT.ready;

const root = document.getElementById('city-root');
const title = document.getElementById('city-title');
const back = document.getElementById('city-back');

const params = new URLSearchParams(location.search);
let provider = params.get('provider');
let id = params.get('id');
const requestedName = params.get('name');
let activeCity = null;
let card = null;

function setBack(city) {
  if (!back) return;
  const href = city ? `./index.html#city=${encodeURIComponent(city.key)}` : './index.html';
  back.href = href;
}

function renderEmpty() {
  title.textContent = PT.i18n.t('appName');
  root.innerHTML = `
    <div class="empty-state">
      <span data-icon="location" data-icon-size="48"></span>
      <h2>${escapeHtml(PT.i18n.t('web.selectCity'))}</h2>
      <button class="btn" type="button" id="city-search-button">${iconSvg('search', { size: 18 })} ${escapeHtml(PT.i18n.t('web.searchCity'))}</button>
    </div>
  `;
  root.querySelector('#city-search-button')?.addEventListener('click', () => {
    openCitySearch((city) => {
      provider = city.provider;
      id = city.id;
      history.replaceState(null, '', `${location.pathname}?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}&lang=${encodeURIComponent(PT.i18n.lang)}`);
      load();
    });
  });
}

async function load() {
  if (!provider || !id) {
    renderEmpty();
    return;
  }

  root.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>${escapeHtml(PT.i18n.t('web.loading'))}</span></div>`;
  try {
    const cacheKey = `city:${provider}:${id}`;
    let city = PT.cities.get(`${provider}:${id}`) || await PT.storage.get(cacheKey, null);
    if (!city) {
      city = await PT.api.city(provider, id);
      if (city) await PT.storage.set(cacheKey, city);
    }
    if (!city) throw new Error('City not found');
    if (requestedName) city.name = requestedName;
    activeCity = city;
    title.textContent = city.name;
    setDocumentTitle(city.name);
    setBack(city);

    root.innerHTML = '';
    card = createCityCard(city);
    root.appendChild(card);

    const data = await PT.times.todayData(city);
    updateCityCard(card, city, data);
    enhanceStandalone(city, card);
  } catch (error) {
    console.warn('[city] load failed', error);
    root.innerHTML = `
      <div class="empty-state">
        <h2>${escapeHtml(PT.i18n.t('web.apiUnavailable'))}</h2>
        <p>${escapeHtml(PT.i18n.t('web.refreshHint'))}</p>
        <button class="btn" type="button" id="city-retry">${escapeHtml(PT.i18n.t('web.retry'))}</button>
      </div>
    `;
    root.querySelector('#city-retry')?.addEventListener('click', load);
  }
}

function enhanceStandalone(city, cardEl) {
  const meta = cardEl.querySelector('.city-card__meta');
  if (meta) {
    meta.hidden = true;
    meta.innerHTML = '';
  }
  const actions = document.createElement('div');
  actions.className = 'city-card__actions';
  actions.innerHTML = `
    <button class="btn" type="button" id="standalone-month">${iconSvg('calendar', { size: 18 })} ${escapeHtml(PT.i18n.t('web.monthView'))}</button>
    <a class="btn" href="./index.html#city=${encodeURIComponent(city.key)}">${iconSvg('arrow-left', { size: 18 })} ${escapeHtml(PT.i18n.t('web.backToApp'))}</a>
  `;
  root.appendChild(actions);
  actions.querySelector('#standalone-month')?.addEventListener('click', () => openMonthView(city));
  requestAnimationFrame(() => fitTexts(cardEl));
}

window.setInterval(() => {
  if (card) updateCityCardLive(card);
}, 1000);

window.addEventListener('pt:themechange', () => {
  if (card) requestAnimationFrame(() => fitTexts(card));
});

load();
