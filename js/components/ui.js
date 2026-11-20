import { PT } from '../boot.js';
import { copyText, escapeHtml } from '../core/format.js';
import { iconSvg } from '../core/icons.js';

export function showToast(message, { duration = 3200 } = {}) {
  if (!message) return;
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  stack.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity .18s, transform .18s';
    window.setTimeout(() => toast.remove(), 200);
  }, duration);
}

export function confirmAction({
  title,
  message,
  confirmText,
  cancelText,
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    const confirm = confirmText || PT.i18n.t('ok');
    const cancel = cancelText || PT.i18n.t('cancel');
    dialog.innerHTML = `
      <div class="modal__header">
        <div class="modal__title">${escapeHtml(title || '')}</div>
        <button class="icon-btn" type="button" data-cancel aria-label="${escapeHtml(cancel)}">${iconSvg('close')}</button>
      </div>
      <div class="modal__body">
        <p>${escapeHtml(message || '')}</p>
        <div class="modal__actions">
          <button class="btn btn--text" type="button" data-cancel>${escapeHtml(cancel)}</button>
          <button class="btn${danger ? ' btn--danger' : ''}" type="button" data-confirm>${escapeHtml(confirm)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const finish = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', () => finish(false)));
    dialog.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.showModal();
    dialog.querySelector('[data-confirm]')?.focus();
  });
}

export function openDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

export function closeDialog(dialog) {
  if (!dialog) return;
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

export function setDocumentTitle(title) {
  if (!title) return;
  const appName = PT.i18n.t('appName');
  document.title = title === appName ? appName : `${title} · ${appName}`;
}

export async function shareOrCopy({ title, text, url }) {
  const shareData = { title, text, url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  const ok = await copyText(url || text || '');
  if (ok) showToast(PT.i18n.t('web.linkCopied'));
  return ok ? 'copied' : 'failed';
}

export function providerBadge(provider) {
  return `<span class="badge">${escapeHtml(provider)}</span>`;
}
