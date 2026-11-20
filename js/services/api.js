import { HttpError } from '../core/http.js';

export const SOURCE_META = {
  Diyanet: { label: 'Diyanet', logo: './assets/img/source-diyanet.png' },
  IGMG: { label: 'IGMG', logo: './assets/img/source-igmg.png' },
  London: { label: 'LondonPrayerTimes.com', logo: null },
  NVC: { label: 'NamazVakti.com', logo: './assets/img/source-nvc.png' },
  Semerkand: { label: 'SemerkandTakvimi', logo: './assets/img/source-semerkand.png' },
  Calc: { label: 'Calc', logo: null, calculated: true },
  CSV: { label: 'CSV', logo: null, unsupported: true },
};

export function sourceMeta(provider) {
  return SOURCE_META[provider] || { label: provider || '—', logo: null };
}

export function providerPath(provider) {
  return encodeURIComponent(provider);
}

export function cityKey(city) {
  return `${city.provider}:${city.id}`;
}

export function normalizeCity(raw, providerHint = null) {
  if (!raw || raw.id == null) return null;
  const provider = raw.provider || providerHint || '';
  const names = Array.isArray(raw.names) ? raw.names.filter(Boolean).map(String) : [];
  const name = names.length ? names[names.length - 1] : String(raw.name || raw.id);
  return {
    id: String(raw.id),
    provider,
    names,
    name,
    country: raw.country || '',
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    elv: raw.elv == null ? null : Number(raw.elv),
    timezone: raw.timezone || 'UTC',
    key: `${provider}:${raw.id}`,
    unsupported: Boolean(SOURCE_META[provider]?.unsupported),
    calculated: Boolean(SOURCE_META[provider]?.calculated),
    calcMethod: (() => {
      if (provider !== 'Calc') return null;
      const parts = String(raw.id).split(';');
      return parts.length >= 5 ? parts[4] : 'MWL';
    })(),
  };
}

export function normalizeTimes(rows) {
  const map = {};
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row?.date) continue;
    map[row.date] = {
      date: row.date,
      fajr: row.fajr || null,
      sun: row.sun || null,
      dhuhr: row.dhuhr || null,
      asr: row.asr || null,
      maghrib: row.maghrib || null,
      ishaa: row.ishaa || row.isha || null,
      asrHanafi: row.asrHanafi || null,
      sabah: row.sabah || null,
      isFajrEstimated: Boolean(row.isFajrEstimated),
      isIshaaEstimated: Boolean(row.isIshaaEstimated),
      isSabahEstimated: Boolean(row.isSabahEstimated),
    };
  }
  return map;
}

export function parseCalcCity(id) {
  const text = String(id || '');
  const parts = text.split(';');
  if (parts.length < 4) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  const elv = Number(parts[2]);
  const timezone = parts[3].replace('::', '/');
  const method = parts[4] || 'MWL';
  const name = timezone.split('/').pop() || 'Calc';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: text,
    provider: 'Calc',
    names: [name],
    name,
    country: '',
    lat,
    lng,
    elv: Number.isFinite(elv) ? elv : null,
    timezone,
    key: `Calc:${text}`,
    unsupported: false,
    calculated: true,
    calcMethod: method,
  };
}

export class ApiService {
  constructor(http) {
    this.http = http;
  }

  async providers() {
    return this.http.getJSON('/');
  }

  async search(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const rows = await this.http.getJSON(`/search?q=${encodeURIComponent(q)}`);
    return (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeCity(row))
      .filter((city) => city && !city.unsupported);
  }

  async nearby(lat, lng) {
    const rows = await this.http.getJSON(`/search?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    return (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeCity(row))
      .filter((city) => city && !city.unsupported);
  }

  async city(provider, id) {
    if (provider === 'Calc') return parseCalcCity(id);
    const result = await this.http.getJSON(`/${providerPath(provider)}/${encodeURIComponent(id)}`);
    return normalizeCity(result, provider);
  }

  async date(dateISO) {
    return this.http.getJSON(`/date/${encodeURIComponent(dateISO)}`);
  }

  async gregYear(year) {
    return this.http.getJSON(`/date/${encodeURIComponent(year)}`);
  }

  async hijriYear(year) {
    return this.http.getJSON(`/hijri/${encodeURIComponent(year)}`);
  }

  async times(city) {
    const path = `/${providerPath(city.provider)}/${encodeURIComponent(city.id)}/json`;
    const rows = await this.http.getJSON(path);
    return normalizeTimes(rows);
  }

  async list(path = []) {
    const suffix = path.map((part) => encodeURIComponent(part)).join('/');
    const result = await this.http.getJSON(`/${suffix}`);
    return result;
  }
}

export function apiErrorMessage(error, i18n) {
  if (error instanceof HttpError) {
    if (error.status === 403) return i18n.t('web.apiUnavailable');
    if (error.status === 429) return i18n.t('web.apiUnavailable');
    if (!error.status) return i18n.t('web.offline');
  }
  return i18n.t('web.apiUnavailable');
}
