import { defineStore } from './storage.js';

export const DEFAULT_SETTINGS = {
  language: 'system',
  theme: 'system',
  numbers: 'normal',
  use12h: false,
  dateformat: 'DD MMM YYYY',
  hdateformat: 'DD MMM YYYY',
  hijri_calculation: 'Diyanet',
  hijri_day_offset: 0,
  vakit_indicator: 'current',
  kerahat_sunrise: 45,
  kerahat_istiva: 45,
  kerahat_sunset: 0,
  arabicNames: false,
  vibration: 1,
  compass_location: null,
  compass_note_seen: false,
  last_city: null,
  install_hint_seen: false,
};

export class SettingsService {
  constructor(storage) {
    this.storage = storage;
    this.store = defineStore(storage, 'settings', {
      version: 1,
      defaults: () => ({ ...DEFAULT_SETTINGS }),
      migrate(old) {
        return { ...DEFAULT_SETTINGS, ...(old || {}) };
      },
    });
    this.data = { ...DEFAULT_SETTINGS };
    this.listeners = new Set();
  }

  async ready() {
    await this.store.ready();
    const stored = await this.store.get();
    this.data = { ...DEFAULT_SETTINGS, ...(stored || {}) };
    await this.store.set(this.data);
    return this;
  }

  get(key, fallback) {
    return this.data[key] ?? fallback;
  }

  all() {
    return { ...this.data };
  }

  async set(key, value) {
    this.data[key] = value;
    await this.store.set(this.data);
    this.emit(key, value);
    return value;
  }

  async setMany(values) {
    this.data = { ...this.data, ...values };
    await this.store.set(this.data);
    for (const [key, value] of Object.entries(values)) this.emit(key, value);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(key, value) {
    this.listeners.forEach((cb) => {
      try { cb(key, value, this.data); } catch (error) { console.warn('[settings] listener', error); }
    });
  }

  async reset() {
    this.data = { ...DEFAULT_SETTINGS };
    await this.store.set(this.data);
    this.emit('*', null);
  }
}

export async function initSettings(storage) {
  const settings = new SettingsService(storage);
  await settings.ready();
  return settings;
}
