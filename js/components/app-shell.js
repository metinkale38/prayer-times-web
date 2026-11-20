import { PT } from '../boot.js';
import { iconSvg, hydrateIcons } from '../core/icons.js';
import { NAV_ITEMS } from '../core/config.js';

class AppShell extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered === 'true') return;
    this.dataset.rendered = 'true';
    this.render();
  }

  render() {
    const page = this.getAttribute('page') || 'times';
    const titleKey = this.getAttribute('title-key') || 'appName';
    const pageTitle = this.getAttribute('title') || PT.i18n.t(titleKey);
    const main = this.querySelector('main') || document.createElement('main');
    const actions = this.querySelector('[data-app-bar-actions]');

    const nav = NAV_ITEMS.map((item) => `
      <a class="drawer__item" href="${item.href}" data-nav="${item.page}" ${item.page === page ? 'aria-current="page"' : ''}>
        <img class="drawer__icon" src="${item.icon}" alt="" width="32" height="32" loading="lazy">
        <span>${PT.i18n.t(item.key)}</span>
      </a>
    `).join('');

    this.innerHTML = `
      <div class="app-frame">
        <header class="app-bar">
          <button class="icon-btn app-bar__menu" type="button" data-drawer-open aria-label="${PT.i18n.t('web.menu') || 'Menü'}" aria-expanded="false" aria-controls="drawer">
            ${iconSvg('menu')}
          </button>
          <h1 class="app-bar__title">${pageTitle}</h1>
          <div class="app-bar__actions">
            <button class="icon-btn" type="button" data-theme-toggle aria-label="${PT.i18n.t('web.nightMode')}">
              ${iconSvg(PT.theme.effective === 'dark' ? 'sun' : 'moon')}
            </button>
          </div>
        </header>
        <div class="drawer-scrim" data-drawer-scrim></div>
        <aside class="drawer" id="drawer" aria-label="${PT.i18n.t('web.appTitle')}" aria-hidden="true">
          <div class="drawer__header">
            <button class="icon-btn drawer__close" type="button" data-drawer-close aria-label="${PT.i18n.t('web.close')}">
              ${iconSvg('close')}
            </button>
            <img class="drawer__logo" src="./assets/img/appicon.png" alt="" width="100" height="100">
            <div class="drawer__app-name">${PT.i18n.t('appName')}</div>
            <div class="drawer__version">${PT.config.APP_VERSION}</div>
            <div class="drawer__bar"></div>
          </div>
          <nav class="drawer__nav" aria-label="${PT.i18n.t('web.appTitle')}">
            ${nav}
          </nav>
          <div class="drawer__footer">${PT.i18n.t('web.webApp')} · v${PT.config.APP_VERSION}</div>
        </aside>
      </div>
    `;

    const frame = this.querySelector('.app-frame');
    main.classList.add('app-main');
    main.id = 'app-main';
    main.tabIndex = -1;
    frame.appendChild(main);

    const actionHost = this.querySelector('.app-bar__actions');
    if (actions) {
      while (actions.firstChild) actionHost.appendChild(actions.firstChild);
      actions.remove();
    }

    hydrateIcons(this);
    PT.i18n.apply(this);
    this._wire(page);
    this._updateThemeIcon();

    window.dispatchEvent(new CustomEvent('pt:shell-ready', { detail: this }));
    PT.resolveShell?.();
  }

  _wire(page) {
    this.menuButton = this.querySelector('[data-drawer-open]');
    this.drawer = this.querySelector('.drawer');
    this.scrim = this.querySelector('[data-drawer-scrim]');
    this.main = this.querySelector('#app-main');
    this.closeButton = this.querySelector('[data-drawer-close]');
    this.themeButton = this.querySelector('[data-theme-toggle]');

    this.menuButton?.addEventListener('click', () => this.openDrawer());
    this.closeButton?.addEventListener('click', () => this.closeDrawer());
    this.scrim?.addEventListener('click', () => this.closeDrawer());
    this.querySelectorAll('[data-nav]').forEach((link) => {
      link.addEventListener('click', () => this.closeDrawer(false));
    });

    this._onKeydown = (event) => {
      if (!this.drawer?.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = this.drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this._onKeydown);

    this._onResize = () => {
      if (window.matchMedia('(min-width: 1200px)').matches) {
        this.drawer?.classList.remove('is-open');
        this.scrim?.classList.remove('is-open');
        document.body.classList.remove('is-locked');
        if (this.drawer) this.drawer.inert = false;
        this.drawer?.setAttribute('aria-hidden', 'false');
      } else if (!this.drawer?.classList.contains('is-open')) {
        if (this.drawer) this.drawer.inert = true;
        this.drawer?.setAttribute('aria-hidden', 'true');
      }
    };
    window.addEventListener('resize', this._onResize);
    this._onResize();

    const themeHandler = () => this._updateThemeIcon();
    window.addEventListener('pt:themechange', themeHandler);
    this._cleanup = () => {
      document.removeEventListener('keydown', this._onKeydown);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('pt:themechange', themeHandler);
    };

    // Keep the page heading in sync with the active nav item when the shell is reused.
    this._page = page;
  }

  _updateThemeIcon() {
    if (!this.themeButton) return;
    this.themeButton.innerHTML = iconSvg(PT.theme.effective === 'dark' ? 'sun' : 'moon');
  }

  openDrawer() {
    if (!this.drawer) return;
    this.drawer.classList.add('is-open');
    this.scrim?.classList.add('is-open');
    this.drawer.inert = false;
    this.drawer.setAttribute('aria-hidden', 'false');
    this.menuButton?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-locked');
    if (this.main) this.main.inert = true;
    const first = this.drawer.querySelector('a[href], button');
    if (first) requestAnimationFrame(() => first.focus());
  }

  closeDrawer(returnFocus = true) {
    if (!this.drawer) return;
    const wasOpen = this.drawer.classList.contains('is-open');
    this.drawer.classList.remove('is-open');
    this.scrim?.classList.remove('is-open');
    this.menuButton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    if (this.main) this.main.inert = false;
    if (!window.matchMedia('(min-width: 1200px)').matches) {
      this.drawer.inert = true;
      this.drawer.setAttribute('aria-hidden', 'true');
    } else {
      this.drawer.setAttribute('aria-hidden', 'false');
    }
    if (wasOpen && returnFocus) this.menuButton?.focus();
  }
}

if (!customElements.get('app-shell')) {
  customElements.define('app-shell', AppShell);
}

export default AppShell;
