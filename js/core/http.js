export class HttpError extends Error {
  constructor(message, { status = 0, url = '', body = null } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class BrowserHttpAdapter {
  name = 'browser-fetch';

  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getJSON(path) {
    const url = `${this.baseUrl}${path}`;
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'default',
      });
    } catch (error) {
      throw new HttpError('Netzwerkfehler', { status: 0, url, body: error?.message });
    }
    if (!response.ok) {
      let body = null;
      try { body = await response.text(); } catch { /* ignore */ }
      const retryAfter = response.headers.get('retry-after');
      const error = new HttpError(`HTTP ${response.status}`, { status: response.status, url, body });
      error.retryAfter = retryAfter ? Number(retryAfter) * 1000 : null;
      throw error;
    }
    return response.json();
  }
}

class DevProxyHttpAdapter {
  name = 'dev-proxy';

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getJSON(path) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.text().catch(() => null);
      const error = new HttpError(`HTTP ${response.status}`, { status: response.status, url, body });
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        error.retryAfter = retry ? Number(retry) * 1000 : null;
      }
      throw error;
    }
    return response.json();
  }
}

class AndroidHttpAdapter {
  name = 'android-bridge';

  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getJSON(path) {
    const url = `${this.baseUrl}${path}`;
    const bridge = window.PrayerTimesAndroid;
    if (!bridge?.httpGet) throw new HttpError('Android HTTP bridge fehlt', { status: 0, url });
    let result;
    try {
      result = await bridge.httpGet(url);
    } catch (error) {
      throw new HttpError('Android HTTP-Fehler', { status: 0, url, body: error?.message });
    }
    if (typeof result === 'string') return JSON.parse(result);
    return result;
  }
}

export class HttpClient {
  constructor(adapter) {
    this.adapter = adapter;
    this.queue = [];
    this.active = 0;
    this.lastStart = 0;
    this.inflight = new Map();
    this.maxConcurrent = 2;
    this.minGap = 180;
  }

  get adapterName() {
    return this.adapter.name;
  }

  async getJSON(path) {
    if (this.inflight.has(path)) return this.inflight.get(path);
    const promise = this._enqueue(path).finally(() => this.inflight.delete(path));
    this.inflight.set(path, promise);
    return promise;
  }

  _enqueue(path) {
    return new Promise((resolve, reject) => {
      this.queue.push({ path, resolve, reject });
      this._pump();
    });
  }

  async _pump() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) return;
    const job = this.queue.shift();
    this.active += 1;
    const wait = Math.max(0, this.minGap - (Date.now() - this.lastStart));
    if (wait) await sleep(wait);
    this.lastStart = Date.now();
    try {
      const data = await this._withRetry(job.path);
      job.resolve(data);
    } catch (error) {
      job.reject(error);
    } finally {
      this.active -= 1;
      this._pump();
    }
  }

  async _withRetry(path) {
    let attempt = 0;
    while (true) {
      try {
        return await this.adapter.getJSON(path);
      } catch (error) {
        const status = error?.status || 0;
        const retryable = status === 0 || status === 429 || status === 502 || status === 503 || status === 504;
        if (!retryable || attempt >= 3) throw error;
        const delay = error.retryAfter ?? Math.min(8000, 400 * (2 ** attempt));
        attempt += 1;
        await sleep(delay);
      }
    }
  }
}

function isLocalDevelopmentHost(host) {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  if (host.endsWith('.local') || host.endsWith('.lan')) return true;
  if (host.startsWith('192.168.') || host.startsWith('10.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

export function createHttp() {
  const bridge = window.PrayerTimesAndroid;
  if (bridge?.httpGet) return new HttpClient(new AndroidHttpAdapter('https://opt.mk38.de'));

  const host = location.hostname;
  if (isLocalDevelopmentHost(host)) {
    return new HttpClient(new DevProxyHttpAdapter('/api'));
  }

  return new HttpClient(new BrowserHttpAdapter('https://opt.mk38.de'));
}
