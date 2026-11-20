const SUPPORTED = ['de', 'en', 'tr'];
const LOCALES = { de: 'de-DE', en: 'en-US', tr: 'tr-TR' };

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FARSI_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeLanguage(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'system') {
    const nav = (navigator.language || 'en').toLowerCase();
    const base = nav.split('-')[0];
    return SUPPORTED.includes(base) ? base : 'en';
  }
  const base = raw.split('-')[0];
  return SUPPORTED.includes(base) ? base : 'en';
}

export class I18n {
  constructor(settings) {
    this.settings = settings;
    this.lang = 'de';
    this.fallbackLang = 'en';
    this.messages = {};
    this.fallback = {};
  }

  async load(overrideLanguage = null) {
    this.lang = normalizeLanguage(overrideLanguage || this.settings.get('language', 'system'));
    const [messages, fallback] = await Promise.all([
      this._fetch(this.lang),
      this.lang === this.fallbackLang ? Promise.resolve(null) : this._fetch(this.fallbackLang),
    ]);
    this.messages = messages || {};
    this.fallback = fallback || messages || {};
    this.applyDocument();
    return this;
  }

  async _fetch(lang) {
    try {
      const response = await fetch(new URL(`../../data/i18n/${lang}.json`, import.meta.url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`[i18n] could not load ${lang}`, error);
      return null;
    }
  }

  applyDocument() {
    const html = document.documentElement;
    html.lang = this.lang;
    html.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    this.apply(document);
  }

  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = this.t(el.dataset.i18n);
      if (value) el.textContent = value;
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const value = this.t(el.dataset.i18nHtml);
      if (value) el.innerHTML = value;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const value = this.t(el.dataset.i18nPlaceholder);
      if (value) el.setAttribute('placeholder', value);
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const value = this.t(el.dataset.i18nTitle);
      if (value) el.setAttribute('title', value);
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const value = this.t(el.dataset.i18nAriaLabel);
      if (value) el.setAttribute('aria-label', value);
    });
    root.querySelectorAll('[data-i18n-aria-roledescription]').forEach((el) => {
      const value = this.t(el.dataset.i18nAriaRoledescription);
      if (value) el.setAttribute('aria-roledescription', value);
    });
  }

  t(key, vars) {
    let template = this.messages?.[key];
    if (template == null) template = this.fallback?.[key];
    if (template == null) return key;
    return this.format(template, vars);
  }

  format(template, vars = {}) {
    if (!vars || (Array.isArray(vars) && vars.length === 0) || Object.keys(vars).length === 0) {
      return String(template).replace(/%(\d+)\$[sd]/g, '').replace(/%[sd]/g, '');
    }
    if (Array.isArray(vars)) {
      return String(template)
        .replace(/%(\d+)\$[sd]/g, (_, index) => String(vars[Number(index) - 1] ?? ''))
        .replace(/%[sd]/g, () => {
          const value = vars.shift();
          return String(value ?? '');
        });
    }
    return String(template)
      .replace(/%(\d+)\$[sd]/g, (_, index) => String(vars[index] ?? ''))
      .replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
  }

  locale() {
    return LOCALES[this.lang] || 'en-US';
  }

  monthName(month, hijri = false) {
    const prefix = hijri ? 'hmonth' : 'gmonth';
    return this.t(`${prefix}${month}`);
  }

  number(value, mode = this.settings.get('numbers', 'normal')) {
    let text = String(value);
    if (mode === 'arabic') text = text.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
    else if (mode === 'farsi') text = text.replace(/\d/g, (d) => FARSI_DIGITS[Number(d)]);
    return text;
  }

  async setLanguage(language, { reload = true } = {}) {
    await this.settings.set('language', language);
    if (reload) {
      window.location.reload();
      return;
    }
    await this.load();
    this.apply(document);
  }
}

export async function initI18n(settings, overrideLanguage = null) {
  const i18n = new I18n(settings);
  await i18n.load(overrideLanguage);
  return i18n;
}
