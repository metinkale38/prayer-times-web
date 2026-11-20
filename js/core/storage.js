/**
 * Platform-independent persistence.
 *
 * The API is intentionally async so the same code works with localStorage,
 * an Android @JavascriptInterface bridge, or an in-memory fallback.
 */

export class MemoryAdapter {
  name = 'memory';

  constructor() {
    this.map = new Map();
  }

  async getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  async setItem(key, value) {
    this.map.set(key, String(value));
  }

  async removeItem(key) {
    this.map.delete(key);
  }

  async keys() {
    return [...this.map.keys()];
  }

  subscribe() {
    return () => {};
  }
}

export class LocalStorageAdapter {
  name = 'local-storage';

  async getItem(key) {
    return localStorage.getItem(key);
  }

  async setItem(key, value) {
    localStorage.setItem(key, String(value));
  }

  async removeItem(key) {
    localStorage.removeItem(key);
  }

  async keys() {
    return Object.keys(localStorage);
  }

  subscribe(callback) {
    const handler = (event) => {
      if (event.key) callback(event.key);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

export class AndroidBridgeAdapter {
  name = 'android-bridge';

  constructor(bridge) {
    this.bridge = bridge;
  }

  async getItem(key) {
    const value = await this.bridge.getString(key);
    return value ?? null;
  }

  async setItem(key, value) {
    await this.bridge.setString(key, String(value));
  }

  async removeItem(key) {
    await this.bridge.remove(key);
  }

  async keys() {
    const value = await this.bridge.keys();
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value || '[]');
    } catch {
      return [];
    }
  }

  subscribe(callback) {
    const prev = window.__ptStorageChanged;
    window.__ptStorageChanged = (key) => {
      try { prev?.(key); } catch { /* ignore */ }
      callback(key);
    };
    return () => {
      window.__ptStorageChanged = prev;
    };
  }
}

export class Storage {
  constructor(adapter, { namespace = 'pt', version = 1 } = {}) {
    this.adapter = adapter;
    this.namespace = namespace;
    this.version = version;
    this.listeners = new Map();
    this._adapterUnsub = null;
  }

  get adapterName() {
    return this.adapter?.name ?? 'unknown';
  }

  _key(key) {
    return `${this.namespace}:v${this.version}:${key}`;
  }

  async get(key, fallback = null) {
    try {
      const raw = await this.adapter.getItem(this._key(key));
      if (raw == null) return fallback;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'data' in parsed) return parsed.data;
      return parsed;
    } catch (error) {
      console.warn('[storage] get failed', key, error);
      return fallback;
    }
  }

  async set(key, value) {
    const envelope = JSON.stringify({ v: this.version, data: value });
    await this.adapter.setItem(this._key(key), envelope);
    this._emit(key, value);
  }

  async remove(key) {
    await this.adapter.removeItem(this._key(key));
    this._emit(key, undefined);
  }

  async keys() {
    try {
      const all = await this.adapter.keys();
      const prefix = `${this.namespace}:v${this.version}:`;
      return all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    } catch {
      return [];
    }
  }

  async update(key, updater) {
    const current = await this.get(key);
    const next = await updater(current);
    await this.set(key, next);
    return next;
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);

    if (!this._adapterUnsub) {
      this._adapterUnsub = this.adapter.subscribe((changedKey) => {
        for (const [listenerKey, callbacks] of this.listeners) {
          if (listenerKey === '*' || this._key(listenerKey) === changedKey) {
            this.get(listenerKey).then((value) => callbacks.forEach((cb) => cb(value)));
          }
        }
      });
    }

    return () => {
      const set = this.listeners.get(key);
      if (!set) return;
      set.delete(callback);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  _emit(key, value) {
    this.listeners.get(key)?.forEach((cb) => {
      try { cb(value); } catch (error) { console.warn('[storage] listener failed', error); }
    });
    this.listeners.get('*')?.forEach((cb) => {
      try { cb({ key, value }); } catch { /* ignore */ }
    });
  }
}

export function createStorage() {
  const bridge = window.PrayerTimesAndroid;
  const storageBridge = bridge?.storage?.getString ? bridge.storage : (bridge?.getString ? bridge : null);
  if (storageBridge) {
    return new Storage(new AndroidBridgeAdapter(storageBridge), { namespace: 'pt', version: 1 });
  }

  try {
    const testKey = 'pt:storage-test';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return new Storage(new LocalStorageAdapter(), { namespace: 'pt', version: 1 });
  } catch {
    return new Storage(new MemoryAdapter(), { namespace: 'pt', version: 1 });
  }
}

export function defineStore(storage, name, { version = 1, defaults, migrate } = {}) {
  const metaKey = `${name}.__version`;

  return {
    async ready() {
      const from = await storage.get(metaKey, 0);
      if (from >= version) return;
      let data = await storage.get(name, typeof defaults === 'function' ? defaults() : defaults);
      if (migrate) data = await migrate(data, from, version);
      await storage.set(name, data);
      await storage.set(metaKey, version);
    },
    get() {
      return storage.get(name, typeof defaults === 'function' ? defaults() : defaults);
    },
    set(value) {
      return storage.set(name, value);
    },
    update(updater) {
      return storage.update(name, updater);
    },
    subscribe(callback) {
      return storage.subscribe(name, callback);
    },
    reset() {
      return storage.set(name, typeof defaults === 'function' ? defaults() : defaults);
    },
  };
}
