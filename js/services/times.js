import { addDays, isoDateInZone, parseHM, partsInZone, zonedTimeToUtc } from '../core/format.js';

export const PRAYER_KEYS = ['fajr', 'sun', 'dhuhr', 'asr', 'maghrib', 'ishaa'];

export class TimesService {
  constructor({ storage, api, settings, i18n }) {
    this.storage = storage;
    this.api = api;
    this.settings = settings;
    this.i18n = i18n;
    this.memory = new Map();
  }

  cacheKey(city) {
    return `times:${city.provider}:${city.id}`;
  }

  async _readCache(city) {
    if (this.memory.has(city.key)) return this.memory.get(city.key);
    const cached = await this.storage.get(this.cacheKey(city), null);
    if (cached) this.memory.set(city.key, cached);
    return cached;
  }

  async _writeCache(city, value) {
    this.memory.set(city.key, value);
    await this.storage.set(this.cacheKey(city), value);
  }

  _prune(days) {
    const cutoff = addDays(new Date().toISOString().slice(0, 10), -95);
    for (const date of Object.keys(days)) {
      if (date < cutoff) delete days[date];
    }
  }

  async getTimes(city, { force = false, allowFetch = true } = {}) {
    const cached = await this._readCache(city);
    const today = isoDateInZone(new Date(), city.timezone);
    const cachedDates = cached?.days ? Object.keys(cached.days).sort() : [];
    const lastDate = cachedDates[cachedDates.length - 1];
    const daysRemaining = lastDate ? Math.round((new Date(`${lastDate}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000) : 0;
    const age = cached?.fetchedAt ? Date.now() - cached.fetchedAt : Infinity;
    const needsRefresh = force || !cached?.days?.[today] || daysRemaining < 15 || age > 7 * 86400000;

    if (!needsRefresh || !allowFetch) {
      return { ...(cached || { days: {} }), stale: false, missingToday: !cached?.days?.[today] };
    }

    try {
      const fetchedDays = await this.api.times(city);
      const days = { ...(cached?.days || {}), ...fetchedDays };
      this._prune(days);
      const value = {
        provider: city.provider,
        id: city.id,
        timezone: city.timezone,
        fetchedAt: Date.now(),
        days,
      };
      await this._writeCache(city, value);
      return { ...value, stale: false };
    } catch (error) {
      if (cached?.days?.[today]) {
        return { ...cached, stale: true, error };
      }
      throw error;
    }
  }

  async getMonth(city, year, month) {
    const cache = await this.getTimes(city, { allowFetch: false });
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const days = Object.values(cache.days || {})
      .filter((day) => day.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { days, cache };
  }

  adjustedDay(city, day) {
    if (!day) return null;
    const offsets = Array.isArray(city.minuteAdj) ? city.minuteAdj : [];
    const tzOffset = Number(city.timezoneOffset || 0) * 60;
    const shift = (time, index) => {
      const hm = parseHM(time);
      if (!hm) return null;
      const total = hm.h * 60 + hm.m + Number(offsets[index] || 0) + tzOffset;
      const normalized = ((total % 1440) + 1440) % 1440;
      return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
    };
    return {
      ...day,
      fajr: shift(day.fajr, 0),
      sun: shift(day.sun, 1),
      dhuhr: shift(day.dhuhr, 2),
      asr: shift(day.asr, 3),
      maghrib: shift(day.maghrib, 4),
      ishaa: shift(day.ishaa, 5),
      asrHanafi: shift(day.asrHanafi, 3),
      sabah: shift(day.sabah, 0),
    };
  }

  displayRows(city, day, lang) {
    if (!day) return [];
    const useHanafi = city.asrType === 'hanafi' && day.asrHanafi;
    const fajrKey = lang === 'tr' ? 'imsak' : 'fajr';
    return [
      { key: 'fajr', labelKey: fajrKey, time: day.fajr },
      { key: 'sun', labelKey: 'sun', time: day.sun },
      { key: 'dhuhr', labelKey: 'zuhr', time: day.dhuhr },
      { key: 'asr', labelKey: 'asr', time: useHanafi ? day.asrHanafi : day.asr },
      { key: 'maghrib', labelKey: 'maghrib', time: day.maghrib },
      { key: 'ishaa', labelKey: 'ishaa', time: day.ishaa },
    ];
  }

  _events(city, cache, dateISO) {
    const day = this.adjustedDay(city, cache.days?.[dateISO]);
    if (!day) return [];
    const events = [];
    for (const key of PRAYER_KEYS) {
      const time = day[key];
      if (!time) continue;
      events.push({
        key,
        date: dateISO,
        time,
        at: zonedTimeToUtc(dateISO, time, city.timezone),
      });
    }
    return events.sort((a, b) => a.at - b.at);
  }

  async nextPrayer(city, cache, now = new Date()) {
    const today = isoDateInZone(now, city.timezone);
    const tomorrow = addDays(today, 1);
    const todayEvents = this._events(city, cache, today);
    const tomorrowEvents = this._events(city, cache, tomorrow);
    const all = [...todayEvents, ...tomorrowEvents].sort((a, b) => a.at - b.at);
    if (all.length === 0) return null;

    let next = all.find((event) => event.at > now);
    if (!next) return null;
    const nextIndex = all.indexOf(next);
    const previous = all[nextIndex - 1] || null;
    const previousToday = previous && previous.date === today ? previous : null;
    const todayNext = todayEvents.find((event) => event.at > now) || null;
    const current = previousToday || (todayNext ? null : todayEvents[todayEvents.length - 1] || null);
    const total = next.at - (previous?.at ?? next.at - 1);
    const elapsed = now - (previous?.at ?? now);
    return {
      next,
      current,
      todayNext,
      previous,
      remaining: Math.max(0, next.at - now),
      progress: total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0,
    };
  }

  kerahat(city, cache, now = new Date()) {
    const today = isoDateInZone(now, city.timezone);
    const day = this.adjustedDay(city, cache.days?.[today]);
    if (!day) return { active: false };
    const sun = parseHM(day.sun);
    const dhuhr = parseHM(day.dhuhr);
    const maghrib = parseHM(day.maghrib);
    if (!sun || !dhuhr || !maghrib) return { active: false };
    const sunriseMin = this.settings.get('kerahat_sunrise', 45);
    const istiwaMin = this.settings.get('kerahat_istiva', 45);
    const sunsetMin = this.settings.get('kerahat_sunset', 0);
    const localNow = partsInZone(now, city.timezone);
    const nowMin = localNow.hour * 60 + localNow.minute + localNow.second / 60;
    const toMin = (hm) => hm.h * 60 + hm.m;
    const sunStart = toMin(sun);
    const dhuhrStart = toMin(dhuhr);
    const maghribStart = toMin(maghrib);

    if (nowMin > sunStart && nowMin < sunStart + sunriseMin) {
      return {
        active: true,
        key: 'sunrise',
        endAt: zonedTimeToUtc(today, day.sun, city.timezone).getTime() + sunriseMin * 60000,
      };
    }
    if (nowMin > dhuhrStart - istiwaMin && nowMin < dhuhrStart) {
      return {
        active: true,
        key: 'istiwa',
        endAt: zonedTimeToUtc(today, day.dhuhr, city.timezone).getTime(),
      };
    }
    if (sunsetMin > 0 && nowMin > maghribStart - sunsetMin && nowMin < maghribStart) {
      return {
        active: true,
        key: 'sunset',
        endAt: zonedTimeToUtc(today, day.maghrib, city.timezone).getTime(),
      };
    }
    return { active: false };
  }

  async todayData(city, now = new Date()) {
    const cache = await this.getTimes(city);
    const today = isoDateInZone(now, city.timezone);
    const day = this.adjustedDay(city, cache.days?.[today]);
    const next = await this.nextPrayer(city, cache, now);
    return {
      cache,
      today,
      day,
      rows: this.displayRows(city, day, this.i18n.lang),
      next,
      kerahat: this.kerahat(city, cache, now),
    };
  }
}
