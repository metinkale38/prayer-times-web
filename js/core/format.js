const pad = (n) => String(n).padStart(2, '0');

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseHM(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

export function minutesOfDay(value) {
  const hm = parseHM(value);
  return hm ? hm.h * 60 + hm.m : null;
}

export function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function isoDateInZone(date, timeZone) {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function zonedTimeToUtc(dateISO, timeHM, timeZone) {
  const [year, month, day] = dateISO.split('-').map(Number);
  const hm = parseHM(timeHM) || { h: 0, m: 0 };
  const desired = Date.UTC(year, month - 1, day, hm.h, hm.m, 0);
  let guess = desired;
  for (let i = 0; i < 3; i += 1) {
    const p = partsInZone(new Date(guess), timeZone);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = desired - actual;
    if (Math.abs(diff) < 1000) break;
    guess += diff;
  }
  return new Date(guess);
}

export function addDays(dateISO, days) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateFromISO(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatCountdown(ms, numbers = 'normal', i18n) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const text = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return i18n ? i18n.number(text, numbers) : text;
}

export function formatTime(value, { use12h = false, numbers = 'normal', i18n } = {}) {
  const hm = parseHM(value);
  if (!hm) return '--:--';
  let h = hm.h;
  let suffix = '';
  if (use12h) {
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
    const text = `${h}:${pad(hm.m)}${suffix}`;
    return i18n ? i18n.number(text, numbers) : text;
  }
  const text = `${pad(h)}:${pad(hm.m)}`;
  return i18n ? i18n.number(text, numbers) : text;
}

export function formatDateParts({ year, month, day }, pattern = 'DD MMM YYYY', { hijri = false, i18n, numbers = 'normal' } = {}) {
  if (!i18n) return `${day}.${month}.${year}`;
  const monthName = i18n.monthName(month, hijri);
  let out = pattern;
  out = out.replace(/YYYY/g, String(year));
  out = out.replace(/YY/g, String(year).slice(-2));
  out = out.replace(/MMMM/g, monthName);
  out = out.replace(/MMM/g, monthName);
  out = out.replace(/MM/g, pad(month));
  out = out.replace(/DD/g, pad(day));
  return i18n.number(out, numbers);
}

export function formatGregorian(dateISO, pattern = 'DD MMM YYYY', opts = {}) {
  const [year, month, day] = dateISO.split('-').map(Number);
  return formatDateParts({ year, month, day }, pattern, { ...opts, hijri: false });
}

export function formatHijri(hijri, pattern = 'DD MMM YYYY', opts = {}) {
  return formatDateParts(hijri, pattern, { ...opts, hijri: true });
}

export function weekdayName(dateISO, i18n) {
  const date = dateFromISO(dateISO);
  return new Intl.DateTimeFormat(i18n?.locale() || 'en-US', { weekday: 'long' }).format(date);
}

export function monthNameGregorian(month, i18n) {
  return i18n.monthName(month, false);
}

export function debounce(fn, wait = 250) {
  let timer = 0;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs = [];
  return (...args) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...lastArgs);
    });
  };
}

/**
 * Reproduces the AutoResizeTextView behaviour: start at 65% of the slot
 * height and reduce in 5% steps until the text fits with a 10% safety margin.
 */
export function fitText(el, { ratio = 0.65, min = 10 } = {}) {
  if (!el) return;
  const container = el.parentElement;
  if (!container) return;
  const height = container.clientHeight;
  const fitToCell = el.dataset.fitWidth === 'self';
  const width = fitToCell ? el.clientWidth : container.clientWidth;
  const safety = fitToCell ? 1.02 : 1.1;
  if (height <= 0 || width <= 0) return;
  const contentWidth = () => {
    if (!fitToCell) return el.scrollWidth;
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  };
  let size = height * ratio;
  el.style.fontSize = `${size}px`;
  el.style.whiteSpace = 'nowrap';
  let guard = 0;
  while (contentWidth() * safety > width && size > min && guard < 40) {
    size -= height * 0.05;
    el.style.fontSize = `${size}px`;
    guard += 1;
  }
}

export function fitTexts(root) {
  root.querySelectorAll('[data-fit-text]').forEach((el) => {
    fitText(el, { ratio: Number(el.dataset.fitRatio || 0.65) });
  });
}

export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
