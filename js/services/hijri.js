import { addDays, dateFromISO } from '../core/format.js';

const EVENT_KEYS = {
  ISLAMIC_NEW_YEAR: 'holyday1',
  ASHURA: 'holyday2',
  MAWLID_AL_NABI: 'holyday3',
  THREE_MONTHS: 'holyday4',
  RAGAIB: 'holyday5',
  MIRAJ: 'holyday6',
  BARAAH: 'holyday7',
  RAMADAN_BEGIN: 'holyday8',
  LAYLATALQADR: 'holyday9',
  LAST_RAMADAN: 'holyday10',
  EID_AL_FITR_DAY1: 'holyday11',
  EID_AL_FITR_DAY2: 'holyday12',
  EID_AL_FITR_DAY3: 'holyday13',
  ARAFAT: 'holyday14',
  EID_AL_ADHA_DAY1: 'holyday15',
  EID_AL_ADHA_DAY2: 'holyday16',
  EID_AL_ADHA_DAY3: 'holyday17',
  EID_AL_ADHA_DAY4: 'holyday18',
};

const ARTICLE_FILES = {
  ISLAMIC_NEW_YEAR: 'hicriyil',
  ASHURA: 'asure',
  MAWLID_AL_NABI: 'mevlid',
  THREE_MONTHS: '3aylar',
  RAGAIB: 'regaib',
  MIRAJ: 'mirac',
  BARAAH: 'berat',
  RAMADAN_BEGIN: 'ramazan',
  LAYLATALQADR: 'kadir',
  LAST_RAMADAN: 'arefe',
  EID_AL_FITR_DAY1: 'ramazanbay',
  EID_AL_FITR_DAY2: 'ramazanbay',
  EID_AL_FITR_DAY3: 'ramazanbay',
  ARAFAT: 'arefe',
  EID_AL_ADHA_DAY1: 'kurban',
  EID_AL_ADHA_DAY2: 'kurban',
  EID_AL_ADHA_DAY3: 'kurban',
  EID_AL_ADHA_DAY4: 'kurban',
};

const UMM_AL_QURA = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function fromIntl(date) {
  const parts = Object.fromEntries(UMM_AL_QURA.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function shiftISO(dateISO, days) {
  return addDays(dateISO, days);
}

export class HijriService {
  constructor({ i18n, settings, api }) {
    this.i18n = i18n;
    this.settings = settings;
    this.api = api;
    this.data = null;
    this.readyPromise = null;
    this.dateCache = new Map();
    this.gregYearCache = new Map();
    this.hijriYearCache = new Map();
  }

  async load() {
    if (this.data) return this.data;
    if (!this.readyPromise) {
      this.readyPromise = fetch(new URL('../../data/hijri.json', import.meta.url))
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          this.data = data;
          this.starts = [...(data.monthStarts || [])].sort((a, b) => a.date.localeCompare(b.date));
          return data;
        });
    }
    return this.readyPromise;
  }

  async ready() {
    await this.load();
    return this;
  }

  settingsFor(overrides = {}) {
    return {
      calculation: overrides.calculation || this.settings.get('hijri_calculation', 'Diyanet'),
      offset: Number(overrides.offset ?? this.settings.get('hijri_day_offset', 0)),
    };
  }

  _parseHijri(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return null;
    return { year, month, day };
  }

  _localEvent(hijri) {
    if (!hijri || !this.data?.events) return null;
    return this.data.events.find((event) => event.hm === hijri.month && event.hd === hijri.day)?.key || null;
  }

  async getDateInfo(dateISO, overrides = {}) {
    await this.load();
    const { calculation, offset } = this.settingsFor(overrides);
    const adjusted = offset ? shiftISO(dateISO, offset) : dateISO;
    const isDiyanet = calculation !== 'UmmulQura' && calculation !== 'Umm al-Qura' && calculation !== 'UmmAlQura';

    if (this.api && isDiyanet) {
      const cacheKey = `${dateISO}:${offset}`;
      if (!this.dateCache.has(cacheKey)) {
        try {
          const response = await this.api.date(adjusted);
          this.dateCache.set(cacheKey, {
            hijri: this._parseHijri(response?.hijri),
            event: response?.event || null,
            source: 'api',
          });
        } catch (error) {
          console.warn('[hijri] API date failed, using local table', error);
          this.dateCache.set(cacheKey, null);
        }
      }
      const cached = this.dateCache.get(cacheKey);
      if (cached?.hijri) {
        return { date: dateISO, hijri: cached.hijri, event: cached.event, calculation: 'Diyanet', source: 'api' };
      }
    }

    const hijri = this.toHijri(dateISO, overrides);
    return { date: dateISO, hijri, event: this._localEvent(hijri), calculation: hijri.calculation, source: 'local' };
  }

  async getHijri(dateISO, overrides = {}) {
    return (await this.getDateInfo(dateISO, overrides)).hijri;
  }

  toHijri(dateISO, overrides = {}) {
    const { calculation, offset } = this.settingsFor(overrides);
    const adjusted = offset ? shiftISO(dateISO, offset) : dateISO;
    if (calculation === 'UmmulQura' || calculation === 'Umm al-Qura' || calculation === 'UmmAlQura') {
      return { ...fromIntl(new Date(`${adjusted}T12:00:00Z`)), calculation: 'UmmulQura' };
    }
    if (!this.starts?.length) return { ...fromIntl(new Date(`${adjusted}T12:00:00Z`)), calculation: 'UmmulQura' };
    const first = this.starts[0].date;
    const last = this.starts[this.starts.length - 1].date;
    if (adjusted < first || adjusted > last) {
      return { ...fromIntl(new Date(`${adjusted}T12:00:00Z`)), calculation: 'UmmulQura', fallback: true };
    }
    let start = this.starts[0];
    for (const item of this.starts) {
      if (item.date <= adjusted) start = item;
      else break;
    }
    const days = Math.round((dateFromISO(adjusted) - dateFromISO(start.date)) / 86400000);
    return {
      year: start.hy,
      month: start.hm,
      day: days + 1,
      calculation: 'Diyanet',
      monthStart: start.date,
    };
  }

  fromHijri(year, month, day, overrides = {}) {
    const { calculation } = this.settingsFor(overrides);
    if (calculation !== 'UmmulQura' && calculation !== 'Umm al-Qura' && calculation !== 'UmmAlQura') {
      const start = this.starts?.find((item) => item.hy === year && item.hm === month);
      if (start) return addDays(start.date, day - 1);
    }
    // Approximate then search. This also covers Umm al-Qura and dates outside the table.
    const estimate = dateFromISO('0622-07-19');
    const approx = new Date(estimate.getTime() + ((year - 1) * 354.367 + (month - 1) * 29.53 + (day - 1)) * 86400000);
    const approxISO = approx.toISOString().slice(0, 10);
    for (let delta = -45; delta <= 45; delta += 1) {
      const candidate = shiftISO(approxISO, delta);
      const hijri = this.toHijri(candidate, { ...overrides, calculation: calculation === 'Diyanet' ? 'UmmulQura' : calculation, offset: 0 });
      if (hijri.year === year && hijri.month === month && hijri.day === day) return candidate;
    }
    return approxISO;
  }

  eventNameKey(key) {
    return EVENT_KEYS[key] || null;
  }

  articleFile(key) {
    return ARTICLE_FILES[key] || null;
  }

  async eventsForHijriYear(year, overrides = {}) {
    await this.load();
    const { calculation, offset } = this.settingsFor(overrides);
    const isDiyanet = calculation !== 'UmmulQura' && calculation !== 'Umm al-Qura' && calculation !== 'UmmAlQura';
    if (this.api && isDiyanet && offset === 0) {
      if (!this.hijriYearCache.has(year)) {
        try {
          const response = await this.api.hijriYear(year);
          const entries = (Array.isArray(response) ? response : [])
            .map((entry) => ({
              date: entry.date,
              hijri: this._parseHijri(entry.hijri),
              key: entry.event || 'MONTH',
              source: 'api',
            }))
            .filter((entry) => entry.date && entry.hijri);
          this.hijriYearCache.set(year, entries);
        } catch (error) {
          console.warn('[hijri] API year failed, using local table', error);
          this.hijriYearCache.set(year, null);
        }
      }
      const cached = this.hijriYearCache.get(year);
      if (cached) return cached.sort((a, b) => a.date.localeCompare(b.date));
    }

    const events = [];
    for (const event of this.data.events) {
      const date = this.fromHijri(year, event.hm, event.hd, overrides);
      events.push({ date, hijri: { year, month: event.hm, day: event.hd }, key: event.key });
    }
    const months = [];
    for (let month = 1; month <= 12; month += 1) {
      months.push({ date: this.fromHijri(year, month, 1, overrides), hijri: { year, month, day: 1 }, key: 'MONTH' });
    }
    return [...events, ...months].sort((a, b) => a.date.localeCompare(b.date));
  }

  async eventsForGregYear(year, overrides = {}) {
    await this.load();
    const { calculation, offset } = this.settingsFor(overrides);
    const isDiyanet = calculation !== 'UmmulQura' && calculation !== 'Umm al-Qura' && calculation !== 'UmmAlQura';
    if (this.api && isDiyanet && offset === 0) {
      if (!this.gregYearCache.has(year)) {
        try {
          const response = await this.api.gregYear(year);
          const entries = (Array.isArray(response) ? response : [])
            .map((entry) => ({
              date: entry.date,
              hijri: this._parseHijri(entry.hijri),
              key: entry.event || 'MONTH',
              source: 'api',
            }))
            .filter((entry) => entry.date && entry.hijri);
          this.gregYearCache.set(year, entries);
        } catch (error) {
          console.warn('[hijri] API year failed, using local table', error);
          this.gregYearCache.set(year, null);
        }
      }
      const cached = this.gregYearCache.get(year);
      if (cached) return cached.sort((a, b) => a.date.localeCompare(b.date));
    }

    const events = [];
    const eventSet = new Set(this.data.events.map((e) => `${e.hm}-${e.hd}`));
    let date = `${year}-01-01`;
    const end = `${year}-12-31`;
    while (date <= end) {
      const hijri = this.toHijri(date, overrides);
      const key = `${hijri.month}-${hijri.day}`;
      if (eventSet.has(key)) {
        const event = this.data.events.find((e) => e.hm === hijri.month && e.hd === hijri.day);
        if (event) events.push({ date, hijri, key: event.key });
      }
      if (hijri.day === 1) events.push({ date, hijri, key: 'MONTH' });
      date = shiftISO(date, 1);
    }
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  async todayEvent(dateISO, overrides = {}) {
    const info = await this.getDateInfo(dateISO, overrides);
    if (!info.event || info.event === 'MONTH') return null;
    return { key: info.event, hijri: info.hijri };
  }
}
