import { PT } from '../boot.js';
import { escapeHtml, fitTexts, formatCountdown, formatGregorian, formatHijri, formatTime, isoDateInZone } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { sourceMeta } from '../services/api.js';

const ROW_KEYS = ['fajr', 'sun', 'dhuhr', 'asr', 'maghrib', 'ishaa'];

function activePrayerKey(next, today) {
  if (!next) return null;
  if (PT.settings.get('vakit_indicator', 'current') === 'next') {
    return next.next?.date === today ? next.next.key : null;
  }
  return next.current?.key || null;
}

function sourceMarkup(provider) {
  const meta = sourceMeta(provider);
  if (provider === 'Calc') return '';
  if (meta.logo) {
    return `
      <img class="city-card__source city-card__source--left" src="${meta.logo}" alt="${escapeHtml(meta.label)}" width="56" height="56">
      <img class="city-card__source city-card__source--right" src="${meta.logo}" alt="" width="56" height="56">
    `;
  }
  return `
    <span class="city-card__source-text city-card__source-text--left">${escapeHtml(meta.label)}</span>
    <span class="city-card__source-text city-card__source-text--right">${escapeHtml(meta.label)}</span>
  `;
}

export function createCityCard(city) {
  const article = document.createElement('article');
  article.className = 'city-card';
  article.dataset.city = city.key;
  article.innerHTML = `
    <div class="city-card__kerahat" hidden></div>
    <div class="city-card__head">
      ${sourceMarkup(city.provider)}
      <div class="city-card__slot"><div class="city-card__date"><span data-fit-text></span></div></div>
      <div class="city-card__slot"><div class="city-card__city"><span data-fit-text></span></div></div>
      <div class="city-card__slot"><div class="city-card__hijri"><span data-fit-text></span></div></div>
    </div>
    <div class="prayer-list">
      ${ROW_KEYS.map((key) => `
        <div class="prayer-row" data-prayer="${key}">
          <div class="prayer-row__label" data-fit-text></div>
          <div class="prayer-row__time" data-fit-text></div>
        </div>
      `).join('')}
    </div>
    <div class="city-card__bottom">
      <div class="city-card__countdown"><span data-fit-text></span></div>
      <div class="city-card__meta"></div>
    </div>
  `;
  return article;
}

export function updateCityCard(card, city, data) {
  const { settings, i18n } = PT;
  const numbers = settings.get('numbers', 'normal');
  const use12h = settings.get('use12h', false);
  const { today, rows, next, kerahat } = data;

  const hijri = data.hijri || PT.hijri.toHijri(today);
  card.querySelector('.city-card__date [data-fit-text]').textContent = formatGregorian(today, settings.get('dateformat', 'DD MMM YYYY'), { i18n, numbers });
  card.querySelector('.city-card__city [data-fit-text]').textContent = city.name;
  card.querySelector('.city-card__hijri [data-fit-text]').textContent = formatHijri(hijri, settings.get('hdateformat', 'DD MMM YYYY'), { i18n, numbers });

  const activeKey = activePrayerKey(next, today);
  const rowsByKey = new Map((rows || []).map((row) => [row.key, row]));
  for (const key of ROW_KEYS) {
    const rowEl = card.querySelector(`[data-prayer="${key}"]`);
    if (!rowEl) continue;
    const row = rowsByKey.get(key);
    rowEl.querySelector('.prayer-row__label').textContent = row ? i18n.t(row.labelKey) : i18n.t(key);
    rowEl.querySelector('.prayer-row__time').textContent = row?.time
      ? formatTime(row.time, { use12h, numbers, i18n })
      : '--:--';
    rowEl.classList.toggle('prayer-row--active', activeKey === key);
  }

  const countdown = card.querySelector('.city-card__countdown [data-fit-text]') || card.querySelector('.city-card__countdown');
  countdown.textContent = next ? formatCountdown(next.remaining, numbers, i18n) : '--:--:--';

  const kerahatEl = card.querySelector('.city-card__kerahat');
  if (kerahat?.active) {
    kerahatEl.hidden = false;
    kerahatEl.innerHTML = `${iconSvg('sun', { size: 16 })}<span>${escapeHtml(i18n.t('kerahatTime'))}</span><span data-kerahat-countdown></span>`;
  } else {
    kerahatEl.hidden = true;
    kerahatEl.innerHTML = '';
  }

  const meta = card.querySelector('.city-card__meta');
  if (meta) {
    meta.hidden = true;
    meta.innerHTML = '';
  }

  card.dataset.today = today;
  card._city = city;
  card._cache = data.cache;
  card._lastRows = rows;
  requestAnimationFrame(() => {
    fitTexts(card);
    updateKerahatCountdown(card, kerahat);
  });
}

export function updateCityCardLive(card, now = new Date()) {
  const city = card._city;
  const cache = card._cache;
  if (!city || !cache) return;
  const today = isoDateInZone(now, city.timezone);
  if (card.dataset.today && card.dataset.today !== today) {
    PT.times.todayData(city, now).then((data) => updateCityCard(card, city, data)).catch(() => {});
    return;
  }

  const numbers = PT.settings.get('numbers', 'normal');
  PT.times.nextPrayer(city, cache, now).then((next) => {
    if (!card.isConnected) return;
    const countdown = card.querySelector('.city-card__countdown [data-fit-text]') || card.querySelector('.city-card__countdown');
    if (countdown) countdown.textContent = next ? formatCountdown(next.remaining, numbers, PT.i18n) : '--:--:--';
    const activeKey = activePrayerKey(next, card.dataset.today);
    card.querySelectorAll('.prayer-row').forEach((rowEl) => {
      rowEl.classList.toggle('prayer-row--active', activeKey === rowEl.dataset.prayer);
    });

    const kerahat = PT.times.kerahat(city, cache, now);
    const kerahatEl = card.querySelector('.city-card__kerahat');
    if (kerahat.active) {
      if (kerahatEl.hidden) {
        kerahatEl.hidden = false;
        kerahatEl.innerHTML = `${iconSvg('sun', { size: 16 })}<span>${escapeHtml(PT.i18n.t('kerahatTime'))}</span><span data-kerahat-countdown></span>`;
      }
      updateKerahatCountdown(card, kerahat, now);
    } else if (!kerahatEl.hidden) {
      kerahatEl.hidden = true;
      kerahatEl.innerHTML = '';
    }
  }).catch(() => {});
}

function updateKerahatCountdown(card, kerahat, now = new Date()) {
  if (!kerahat?.active || !kerahat.endAt) return;
  const el = card.querySelector('[data-kerahat-countdown]');
  if (!el) return;
  const remaining = Math.max(0, kerahat.endAt - now.getTime());
  const total = Math.floor(remaining / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
