import { defineStore } from '../core/storage.js';

export const DHIKR_COLORS = [
  '#00bcd4', '#ffc107', '#e51c23', '#259b24',
  '#795548', '#903ae8', '#e91e63', '#ffeb3b',
];

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `dhikr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class DhikrService {
  constructor({ storage, i18n }) {
    this.storage = storage;
    this.i18n = i18n;
    this.store = defineStore(storage, 'dhikr', {
      version: 1,
      defaults: () => [],
      migrate(old) {
        return Array.isArray(old) ? old : [];
      },
    });
    this.items = [];
    this.listeners = new Set();
  }

  async ready() {
    await this.store.ready();
    const stored = await this.store.get();
    this.items = (Array.isArray(stored) ? stored : [])
      .filter((item) => item && item.title)
      .map((item, index) => ({
        id: item.id || uuid(),
        title: String(item.title).slice(0, 20),
        target: Math.max(1, Number(item.target || item.max || 33)),
        value: Math.max(0, Number(item.value || 0)),
        color: item.color || DHIKR_COLORS[0],
        position: Number.isFinite(item.position) ? item.position : index,
        updatedAt: item.updatedAt || Date.now(),
      }))
      .sort((a, b) => a.position - b.position);

    if (this.items.length === 0) {
      this.items = [this._newItem(this.i18n?.t('tasbih') || 'Tasbih', 33, DHIKR_COLORS[0], 0)];
      await this._persist();
    }
    return this;
  }

  _newItem(title, target, color, position) {
    return {
      id: uuid(),
      title: String(title || this.i18n?.t('web.addDhikr') || 'Dhikr').slice(0, 20),
      target: Math.max(1, Number(target) || 33),
      value: 0,
      color: color || DHIKR_COLORS[0],
      position,
      updatedAt: Date.now(),
    };
  }

  all() {
    return this.items.slice().sort((a, b) => a.position - b.position);
  }

  get(id) {
    return this.items.find((item) => item.id === id) || null;
  }

  async _persist() {
    this.items = this.items.map((item, index) => ({ ...item, position: index }));
    await this.store.set(this.items);
    this.listeners.forEach((cb) => {
      try { cb(this.all()); } catch (error) { console.warn('[dhikr] listener', error); }
    });
  }

  async add({ title, target = 33, color = DHIKR_COLORS[0] } = {}) {
    const item = this._newItem(title, target, color, this.items.length);
    this.items.push(item);
    await this._persist();
    return item;
  }

  async update(id, patch) {
    const item = this.get(id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: Date.now() });
    if (patch.target != null) item.target = Math.max(1, Number(patch.target) || 1);
    if (patch.title != null) item.title = String(patch.title).slice(0, 20);
    await this._persist();
    return item;
  }

  async increment(id, by = 1) {
    const item = this.get(id);
    if (!item) return null;
    item.value = Math.max(0, item.value + by);
    item.updatedAt = Date.now();
    await this._persist();
    return item;
  }

  async reset(id) {
    return this.update(id, { value: 0 });
  }

  async remove(id) {
    this.items = this.items.filter((item) => item.id !== id);
    if (this.items.length === 0) {
      this.items = [this._newItem(this.i18n?.t('tasbih') || 'Tasbih', 33, DHIKR_COLORS[0], 0)];
    }
    await this._persist();
  }

  async move(id, direction) {
    const index = this.items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.items.length) return false;
    const [item] = this.items.splice(index, 1);
    this.items.splice(target, 0, item);
    await this._persist();
    return true;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}
