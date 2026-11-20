import { PT } from '../boot.js';
import { debounce, escapeHtml } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { apiErrorMessage, sourceMeta } from '../services/api.js';
import { closeDialog, openDialog, showToast } from './ui.js';

let dialog = null;
let currentOnSelect = null;
let locateNearby = null;

function buildDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.id = 'city-search-dialog';
  dialog.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${escapeHtml(PT.i18n.t('web.searchCity'))}</div>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="modal__body">
      <div class="city-search">
        <div class="city-search__input-row">
          <input class="input" type="search" autocomplete="off" data-search-input placeholder="${escapeHtml(PT.i18n.t('web.searchCityHint'))}" aria-label="${escapeHtml(PT.i18n.t('web.searchCity'))}">
          <button class="icon-btn icon-btn--dark" type="button" data-location aria-label="${escapeHtml(PT.i18n.t('web.useLocation'))}">${iconSvg('location')}</button>
        </div>
        <div class="city-search__status" data-status></div>
        <div class="city-search__results" data-results></div>
        <div class="city-search__hint">${escapeHtml(PT.i18n.t('web.autoLocation'))}</div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const input = dialog.querySelector('[data-search-input]');
  const status = dialog.querySelector('[data-status]');
  const results = dialog.querySelector('[data-results]');

  const setStatus = (text, isError = false) => {
    status.textContent = text || '';
    status.classList.toggle('notice--error', Boolean(isError));
  };

  const renderResults = (cities, { nearby = false } = {}) => {
    results.innerHTML = '';
    if (!cities.length) {
      setStatus(PT.i18n.t('web.noSearchResults'));
      return;
    }
    setStatus(`${cities.length} ${PT.i18n.t('web.searchResults')}`);
    for (const city of cities) {
      const meta = sourceMeta(city.provider);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-result';
      button.innerHTML = `
        <div class="city-result__main">
          <div class="city-result__name">${escapeHtml(city.name)}</div>
          <div class="city-result__meta">${escapeHtml(city.names.slice(0, -1).join(' · '))}${city.country ? ` · ${escapeHtml(city.country)}` : ''} · ${escapeHtml(meta.label)}</div>
        </div>
        ${meta.logo ? `<img class="city-result__logo" src="${meta.logo}" alt="" width="44" height="44">` : `<span class="city-result__provider">${escapeHtml(meta.label)}</span>`}
      `;
      button.addEventListener('click', () => {
        currentOnSelect?.({ ...city, autoLocation: nearby });
        closeDialog(dialog);
      });
      results.appendChild(button);
    }
  };

  const search = debounce(async () => {
    const query = input.value.trim();
    if (query.length < 2) {
      results.innerHTML = '';
      setStatus('');
      return;
    }
    setStatus(PT.i18n.t('web.loading'));
    try {
      const cities = await PT.api.search(query);
      renderResults(cities);
    } catch (error) {
      console.warn(error);
      setStatus(apiErrorMessage(error, PT.i18n), true);
    }
  }, 320);

  input.addEventListener('input', search);

  locateNearby = async () => {
    setStatus(PT.i18n.t('web.loading'));
    results.innerHTML = '';
    try {
      const cities = await PT.cities.nearbyFromDevice();
      renderResults(cities, { nearby: true });
    } catch (error) {
      console.warn(error);
      const message = error?.code === 1 ? PT.i18n.t('web.locationDenied') : PT.i18n.t('web.apiUnavailable');
      setStatus(message, true);
      showToast(message);
    }
  };

  dialog.querySelector('[data-location]')?.addEventListener('click', () => locateNearby?.());

  return dialog;
}

export function openCitySearch(onSelect, { nearMe = false } = {}) {
  if (!dialog) buildDialog();
  currentOnSelect = onSelect;
  const input = dialog.querySelector('[data-search-input]');
  const results = dialog.querySelector('[data-results]');
  const status = dialog.querySelector('[data-status]');
  if (input) input.value = '';
  if (results) results.innerHTML = '';
  if (status) status.textContent = '';
  openDialog(dialog);
  window.setTimeout(() => {
    if (nearMe) locateNearby?.();
    else input?.focus();
  }, 60);
}
