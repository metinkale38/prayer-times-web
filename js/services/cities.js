import { defineStore } from '../core/storage.js';
import { cityKey } from './api.js';

export class CitiesService {
  constructor({ storage, settings, api }) {
    this.storage = storage;
    this.settings = settings;
    this.api = api;
    this.store = defineStore(storage, 'cities', {
      version: 1,
      defaults: () => [],
      migrate(old) {
        if (!Array.isArray(old)) return [];
        return old.map((city, index) => ({
          ...city,
          sortId: Number.isFinite(city.sortId) ? city.sortId : index,
          minuteAdj: Array.isArray(city.minuteAdj) ? city.minuteAdj : [0, 0, 0, 0, 0, 0],
          asrType: city.asrType || 'shafi',
          timezoneOffset: Number(city.timezoneOffset || 0),
        }));
      },
    });
    this.cities = [];
    this.listeners = new Set();
  }

  async ready() {
    await this.store.ready();
    const stored = await this.store.get();
    this.cities = (Array.isArray(stored) ? stored : [])
      .filter((city) => city && city.provider && city.id)
      .map((city, index) => ({
        ...city,
        key: city.key || cityKey(city),
        sortId: Number.isFinite(city.sortId) ? city.sortId : index,
        minuteAdj: Array.isArray(city.minuteAdj) ? city.minuteAdj.slice(0, 6) : [0, 0, 0, 0, 0, 0],
        asrType: city.asrType || 'shafi',
        timezoneOffset: Number(city.timezoneOffset || 0),
      }))
      .sort((a, b) => a.sortId - b.sortId);
    await this._persist();
    return this;
  }

  all() {
    return this.cities.slice();
  }

  get(key) {
    return this.cities.find((city) => city.key === key) || null;
  }

  has(key) {
    return this.cities.some((city) => city.key === key);
  }

  async _persist() {
    this.cities = this.cities.map((city, index) => ({ ...city, sortId: index }));
    await this.store.set(this.cities);
    this.listeners.forEach((cb) => {
      try { cb(this.cities); } catch (error) { console.warn('[cities] listener', error); }
    });
  }

  async add(city) {
    if (!city) return null;
    const key = city.key || cityKey(city);
    const existing = this.get(key);
    if (existing) return existing;
    const entry = {
      ...city,
      key,
      sortId: this.cities.length,
      minuteAdj: [0, 0, 0, 0, 0, 0],
      asrType: 'shafi',
      timezoneOffset: 0,
      autoLocation: Boolean(city.autoLocation),
      addedAt: Date.now(),
    };
    this.cities.push(entry);
    await this._persist();
    return entry;
  }

  async remove(key) {
    const before = this.cities.length;
    this.cities = this.cities.filter((city) => city.key !== key);
    if (this.cities.length !== before) await this._persist();
  }

  async update(key, patch) {
    const index = this.cities.findIndex((city) => city.key === key);
    if (index < 0) return null;
    this.cities[index] = { ...this.cities[index], ...patch, key };
    await this._persist();
    return this.cities[index];
  }

  async move(key, direction) {
    const index = this.cities.findIndex((city) => city.key === key);
    if (index < 0) return false;
    const target = index + direction;
    if (target < 0 || target >= this.cities.length) return false;
    const [item] = this.cities.splice(index, 1);
    this.cities.splice(target, 0, item);
    await this._persist();
    return true;
  }

  async moveTo(key, targetIndex) {
    const index = this.cities.findIndex((city) => city.key === key);
    if (index < 0) return false;
    const [item] = this.cities.splice(index, 1);
    this.cities.splice(Math.max(0, Math.min(this.cities.length, targetIndex)), 0, item);
    await this._persist();
    return true;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async setLast(key) {
    await this.settings.set('last_city', key || null);
  }

  async resolveLocation() {
    if (!navigator.geolocation) throw new Error('geolocation-unavailable');
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    const results = await this.api.nearby(position.coords.latitude, position.coords.longitude);
    if (!results.length) throw new Error('no-city-found');
    return results[0];
  }
}
