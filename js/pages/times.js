import { PT } from '../boot.js';
import { escapeHtml, fitTexts, formatTime, isoDateInZone, rafThrottle } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { createCityCard, updateCityCard, updateCityCardLive } from '../components/city-card.js';
import { renderCityList } from '../components/city-list.js';
import { openCitySearch } from '../components/city-search.js';
import { openMonthView } from '../components/month-view.js';
import { confirmAction, openDialog, closeDialog, setDocumentTitle, shareOrCopy, showToast } from '../components/ui.js';
import { apiErrorMessage, sourceMeta } from '../services/api.js';

await PT.ready;
await PT.shellReady;

const pager = document.getElementById('times-pager');
const listEl = document.getElementById('city-list');
const emptyEl = document.getElementById('city-list-empty');
const footer = document.getElementById('times-footer');
const footerLabel = footer?.querySelector('[data-footer-label]');
const fab = document.getElementById('times-fab');
const holidayBanner = document.getElementById('holyday-banner');
const statusRegion = document.getElementById('pager-status');
const actionAdd = document.getElementById('action-add');
const actionMore = document.getElementById('action-more');
const appTitle = document.querySelector('.app-bar__title');

let activeIndex = 0;
let activeKey = null;
let moreDialog = null;
let navigationToken = 0;

setDocumentTitle(PT.i18n.t('appName'));
if (appTitle) appTitle.textContent = PT.i18n.t('appName');

function citySlideIndex(key) {
  return [...pager.querySelectorAll('.pager-slide')].findIndex((slide) => slide.dataset.slide === key);
}

function slides() {
  return [...pager.querySelectorAll('.pager-slide')];
}

function goTo(index, smooth = true) {
  navigationToken += 1;
  const max = Math.max(0, slides().length - 1);
  const safe = Math.max(0, Math.min(max, index));
  pager.scrollTo({ left: safe * pager.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  activeIndex = safe;
  requestAnimationFrame(() => updateActive(safe));
}

function updateActive(index) {
  const all = slides();
  if (!all.length) return;
  const slide = all[index];
  activeIndex = index;
  const isCity = slide?.dataset.slide && slide.dataset.slide !== 'cities';
  activeKey = isCity ? slide.dataset.slide : null;

  if (footerLabel) footerLabel.textContent = PT.i18n.t(isCity ? 'monthly' : 'cities');
  footer.disabled = !isCity;
  footer.setAttribute('aria-disabled', String(!isCity));
  fab.hidden = isCity;
  if (actionMore) actionMore.hidden = !isCity;

  const city = activeKey ? PT.cities.get(activeKey) : null;
  if (appTitle) appTitle.textContent = PT.i18n.t('appName');
  setDocumentTitle(city ? city.name : PT.i18n.t('appName'));

  if (city) {
    PT.settings.set('last_city', city.key);
    history.replaceState(null, '', `${location.pathname}${location.search}#city=${encodeURIComponent(city.key)}`);
    updateHolidayBanner(city);
  } else {
    PT.settings.set('last_city', null);
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    updateHolidayBanner(PT.cities.all()[0] || null);
  }

  if (statusRegion) {
    statusRegion.textContent = city ? `${PT.i18n.t('web.city')} ${index} / ${all.length - 1}: ${city.name}` : PT.i18n.t('cities');
  }
  const card = slide?.querySelector('.city-card');
  if (card) requestAnimationFrame(() => fitTexts(card));
}

async function updateHolidayBanner(city) {
  if (!holidayBanner) return;
  try {
    const tz = city?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = isoDateInZone(new Date(), tz);
    const event = await PT.hijri.todayEvent(today);
    const key = event ? PT.hijri.eventNameKey(event.key) : null;
    if (!key) {
      holidayBanner.hidden = true;
      holidayBanner.textContent = '';
      return;
    }
    const hijri = event.hijri;
    holidayBanner.hidden = false;
    holidayBanner.innerHTML = `<a href="./calendar.html?type=hijri&year=${hijri.year}">${escapeHtml(PT.i18n.t(key))}</a>`;
  } catch {
    holidayBanner.hidden = true;
  }
}

function renderCities({ keepActive = true, targetCityKey = null } = {}) {
  const cities = PT.cities.all();
  const previousKey = targetCityKey || (keepActive ? activeKey : null);
  for (const slide of pager.querySelectorAll('.pager-slide[data-city]')) slide.remove();

  renderCityList(listEl, emptyEl, {
    cities,
    onSelect: (city) => {
      const index = citySlideIndex(city.key);
      if (index >= 0) goTo(index);
    },
    onDelete: async (city) => {
      const wasActive = activeKey === city.key;
      await PT.cities.remove(city.key);
      if (wasActive) {
        activeKey = null;
        renderCities({ keepActive: false });
        goTo(0, false);
      } else {
        renderCities();
      }
    },
    onMove: async (city, direction) => {
      await PT.cities.move(city.key, direction);
      renderCities();
    },
    onAdd: () => openCitySearch(onCitySelected),
    onUseLocation: useLocation,
  });

  for (const city of cities) {
    const slide = document.createElement('section');
    slide.className = 'pager-slide';
    slide.dataset.slide = city.key;
    slide.dataset.city = 'true';
    slide.setAttribute('aria-label', city.name);
    const card = createCityCard(city);
    slide.appendChild(card);
    pager.appendChild(slide);
    loadCard(card, city);
  }

  const resolvedKey = previousKey && cities.some((c) => c.key === previousKey) ? previousKey : null;
  const targetIndex = resolvedKey ? citySlideIndex(resolvedKey) : 0;
  const token = ++navigationToken;
  requestAnimationFrame(() => {
    if (token !== navigationToken) return;
    goTo(Math.max(0, targetIndex), false);
  });
  hydrateIconsIn(listEl);
  hydrateIconsIn(emptyEl);
}

function hydrateIconsIn(root) {
  if (!root) return;
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconRendered === 'true') return;
    el.innerHTML = iconSvg(el.dataset.icon, { size: Number(el.dataset.iconSize || 20) });
    el.dataset.iconRendered = 'true';
  });
}

async function loadCard(card, city) {
  const cityEl = card.querySelector('.city-card__city [data-fit-text]');
  if (cityEl) cityEl.textContent = city.name;
  try {
    const data = await PT.times.todayData(city);
    updateCityCard(card, city, data);
  } catch (error) {
    console.warn('[times] card failed', city, error);
    const date = card.querySelector('.city-card__date [data-fit-text]') || card.querySelector('.city-card__date');
    const hijri = card.querySelector('.city-card__hijri [data-fit-text]') || card.querySelector('.city-card__hijri');
    const countdown = card.querySelector('.city-card__countdown [data-fit-text]') || card.querySelector('.city-card__countdown');
    if (date) date.textContent = PT.i18n.t('web.apiUnavailable');
    if (hijri) hijri.textContent = '';
    if (countdown) countdown.textContent = '--:--:--';
    const meta = card.querySelector('.city-card__meta');
    if (meta) {
      meta.innerHTML = `<span>${escapeHtml(sourceMeta(city.provider).label)}</span><button class="btn btn--text btn--small" type="button" data-retry>${escapeHtml(PT.i18n.t('web.retry'))}</button>`;
      meta.querySelector('[data-retry]')?.addEventListener('click', () => loadCard(card, city));
    }
    card.querySelectorAll('.prayer-row').forEach((row) => row.classList.remove('prayer-row--active'));
  }
}

async function useLocation() {
  try {
    showToast(PT.i18n.t('web.loading'), { duration: 1400 });
    const city = await PT.cities.resolveLocation();
    await onCitySelected({ ...city, autoLocation: true });
  } catch (error) {
    console.warn(error);
    showToast(error?.code === 1 ? PT.i18n.t('web.locationDenied') : PT.i18n.t('web.apiUnavailable'));
  }
}

async function onCitySelected(city) {
  const existing = PT.cities.get(city.key);
  if (existing) {
    renderCities();
    const index = citySlideIndex(existing.key);
    if (index >= 0) goTo(index);
    showToast(PT.i18n.t('web.alreadyAdded'));
    return;
  }
  const added = await PT.cities.add(city);
  renderCities({ keepActive: false, targetCityKey: added.key });
  showToast(PT.i18n.t('web.added'));
}

function activeCity() {
  return activeKey ? PT.cities.get(activeKey) : null;
}

function activeCard() {
  const city = activeCity();
  return city ? document.querySelector(`.city-card[data-city="${CSS.escape(city.key)}"]`) : null;
}

function buildMoreDialog() {
  if (moreDialog) return moreDialog;
  moreDialog = document.createElement('dialog');
  moreDialog.className = 'modal';
  moreDialog.innerHTML = `
    <div class="modal__header">
      <div class="modal__title" data-more-title></div>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="modal__body">
      <div class="dialog-list">
        <button class="btn" type="button" data-share>${iconSvg('share')} ${escapeHtml(PT.i18n.t('share'))}</button>
        <button class="btn" type="button" data-sync>${iconSvg('refresh')} ${escapeHtml(PT.i18n.t('web.sync'))}</button>
        <a class="btn" href="#" target="_blank" rel="noopener" data-standalone>${iconSvg('external')} ${escapeHtml(PT.i18n.t('web.openStandalone'))}</a>
        <button class="btn" type="button" data-month>${iconSvg('calendar')} ${escapeHtml(PT.i18n.t('web.monthly'))}</button>
        <button class="btn" type="button" data-settings>${iconSvg('settings')} ${escapeHtml(PT.i18n.t('web.citySettings'))}</button>
        <button class="btn" type="button" data-remove>${iconSvg('delete')} ${escapeHtml(PT.i18n.t('web.removeCity'))}</button>
      </div>
    </div>
  `;
  document.body.appendChild(moreDialog);
  moreDialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeDialog(moreDialog);
  });
  return moreDialog;
}

function openMore() {
  const city = activeCity();
  const card = activeCard();
  if (!city) return;
  const dialog = buildMoreDialog();
  dialog.querySelector('[data-more-title]').textContent = city.name;
  const standalone = dialog.querySelector('[data-standalone]');
  standalone.href = `./city.html?provider=${encodeURIComponent(city.provider)}&id=${encodeURIComponent(city.id)}&lang=${encodeURIComponent(PT.i18n.lang)}`;

  dialog.querySelector('[data-share]').onclick = async () => {
    closeDialog(dialog);
    const rows = card?._lastRows || [];
    const lines = rows.map((row) => `${PT.i18n.t(row.labelKey)}: ${formatTime(row.time, { use12h: PT.settings.get('use12h'), numbers: PT.settings.get('numbers'), i18n: PT.i18n })}`);
    const title = PT.i18n.format(PT.i18n.t('web.shareTimes'), [city.name]);
    await shareOrCopy({ title, text: `${title}\n${lines.join('\n')}`, url: location.href });
  };

  dialog.querySelector('[data-sync]').onclick = async () => {
    closeDialog(dialog);
    try {
      showToast(PT.i18n.t('web.loading'), { duration: 1200 });
      const data = await PT.times.todayData(city);
      if (card) updateCityCard(card, city, data);
      showToast(PT.i18n.t('web.synced'));
    } catch (error) {
      showToast(apiErrorMessage(error, PT.i18n));
    }
  };

  dialog.querySelector('[data-month]').onclick = () => {
    closeDialog(dialog);
    openMonthFor(city);
  };

  dialog.querySelector('[data-settings]').onclick = () => {
    closeDialog(dialog);
    openCitySettings(city, card);
  };

  dialog.querySelector('[data-remove]').onclick = async () => {
    closeDialog(dialog);
    const ok = await confirmAction({
      title: PT.i18n.t('web.removeCity'),
      message: PT.i18n.format(PT.i18n.t('web.removeCityConfirm'), [city.name]),
      confirmText: PT.i18n.t('delete'),
    });
    if (!ok) return;
    await PT.cities.remove(city.key);
    activeKey = null;
    renderCities({ keepActive: false });
    goTo(0, false);
  };

  openDialog(dialog);
}

function openMonthFor(city) {
  openMonthView(city);
}

function openCitySettings(city, card) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const offsets = city.minuteAdj || [0, 0, 0, 0, 0, 0];
  const labels = ['fajr', 'sun', 'zuhr', 'asr', 'maghrib', 'ishaa'];
  dialog.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${escapeHtml(city.name)}</div>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="modal__body">
      <div class="stack">
        <div class="field">
          <label for="city-asr">${escapeHtml(PT.i18n.t('web.asrType'))}</label>
          <select class="select" id="city-asr">
            <option value="shafi">${escapeHtml(PT.i18n.t('web.shafi'))}</option>
            <option value="hanafi">${escapeHtml(PT.i18n.t('web.hanafi'))}</option>
            <option value="both">${escapeHtml(PT.i18n.t('web.both'))}</option>
          </select>
        </div>
        <div class="field">
          <div class="field__label">${escapeHtml(PT.i18n.t('web.minuteAdjust'))}</div>
          <div class="settings-offsets">
            ${labels.map((key, index) => `
              <label class="offset-row">
                <span>${escapeHtml(PT.i18n.t(key === 'fajr' && PT.i18n.lang === 'tr' ? 'imsak' : key))}</span>
                <input class="input" type="number" min="-120" max="120" step="1" value="${Number(offsets[index] || 0)}" data-offset="${index}">
              </label>
            `).join('')}
          </div>
        </div>
        <div class="field">
          <label for="city-tz">${escapeHtml(PT.i18n.t('web.timezoneOffset'))}</label>
          <input class="input" id="city-tz" type="number" min="-14" max="14" step="0.5" value="${Number(city.timezoneOffset || 0)}">
        </div>
        <div class="modal__actions">
          <button class="btn btn--text" type="button" data-close>${escapeHtml(PT.i18n.t('cancel'))}</button>
          <button class="btn" type="button" data-save>${escapeHtml(PT.i18n.t('web.save'))}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('#city-asr').value = city.asrType || 'shafi';
  const close = () => { closeDialog(dialog); dialog.remove(); };
  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.querySelector('[data-save]').addEventListener('click', async () => {
    const asrType = dialog.querySelector('#city-asr').value;
    const minuteAdj = [...dialog.querySelectorAll('[data-offset]')].map((input) => Number(input.value || 0));
    const timezoneOffset = Number(dialog.querySelector('#city-tz').value || 0);
    await PT.cities.update(city.key, { asrType, minuteAdj, timezoneOffset });
    close();
    const updated = PT.cities.get(city.key);
    if (updated && card) {
      const data = await PT.times.todayData(updated);
      updateCityCard(card, updated, data);
    }
    showToast(PT.i18n.t('web.settingsSaved'));
  });
  openDialog(dialog);
}

footer?.addEventListener('click', () => {
  const city = activeCity();
  if (city) openMonthFor(city);
});

fab?.addEventListener('click', () => openCitySearch(onCitySelected));
actionAdd?.addEventListener('click', () => openCitySearch(onCitySelected));
actionMore?.addEventListener('click', openMore);

pager.addEventListener('scroll', rafThrottle(() => {
  const index = Math.round(pager.scrollLeft / pager.clientWidth);
  if (index !== activeIndex) updateActive(index);
}), { passive: true });

pager.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeIndex - 1); }
  if (event.key === 'Home') { event.preventDefault(); goTo(0); }
  if (event.key === 'End') { event.preventDefault(); goTo(slides().length - 1); }
});

window.addEventListener('resize', rafThrottle(() => {
  pager.scrollLeft = activeIndex * pager.clientWidth;
  slides().forEach((slide) => {
    const card = slide.querySelector('.city-card');
    if (card) fitTexts(card);
  });
}));

window.setInterval(() => {
  document.querySelectorAll('.city-card').forEach((card) => updateCityCardLive(card));
}, 1000);

async function handleDeepLink() {
  const hash = location.hash;
  if (!hash.startsWith('#city=')) return false;
  const key = decodeURIComponent(hash.slice(6));
  if (!key) return false;
  if (PT.cities.has(key)) {
    const index = citySlideIndex(key);
    if (index >= 0) { goTo(index, false); return true; }
  }
  const [provider, ...idParts] = key.split(':');
  const id = idParts.join(':');
  if (!provider || !id) return false;
  try {
    const city = await PT.api.city(provider, id);
    if (!city) return false;
    const added = await PT.cities.add(city);
    renderCities({ keepActive: false, targetCityKey: added.key });
    return true;
  } catch (error) {
    console.warn('[times] deep link failed', error);
    return false;
  }
}

async function start() {
  const last = PT.settings.get('last_city', null);
  const target = last && PT.cities.has(last) ? last : null;
  renderCities({ keepActive: false, targetCityKey: target });
  const deepLinked = await handleDeepLink();
  if (!deepLinked) {
    updateHolidayBanner(activeCity() || PT.cities.all()[0] || null);
  }
}

start();

window.addEventListener('hashchange', () => { handleDeepLink(); });
