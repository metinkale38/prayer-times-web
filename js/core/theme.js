const THEME_KEY = 'pt.theme';
const MODES = ['system', 'light', 'dark'];

export class ThemeService {
  constructor(settings) {
    this.settings = settings;
    this.mode = 'system';
    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    this.onMediaChange = () => {
      if (this.mode === 'system') this.apply();
    };
  }

  async init() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    this.mode = MODES.includes(stored) ? stored : this.settings.get('theme', 'system');
    this.media.addEventListener?.('change', this.onMediaChange);
    this.apply();
    return this;
  }

  get effective() {
    if (this.mode === 'system') return this.media.matches ? 'dark' : 'light';
    return this.mode;
  }

  apply() {
    const effective = this.effective;
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
    const color = effective === 'dark' ? '#4a768a' : '#0288d1';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    document.documentElement.style.setProperty('--theme-color', color);
    window.dispatchEvent(new CustomEvent('pt:themechange', { detail: { effective } }));
  }

  async set(mode) {
    if (!MODES.includes(mode)) mode = 'system';
    this.mode = mode;
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
    await this.settings.set('theme', mode);
    this.apply();
    return mode;
  }

  async toggle() {
    // Quick toolbar switch: light <-> dark. "System" remains available in settings.
    const next = this.effective === 'dark' ? 'light' : 'dark';
    await this.set(next);
    return next;
  }
}

export async function initTheme(settings) {
  const theme = new ThemeService(settings);
  await theme.init();
  return theme;
}
