import { PT } from '../boot.js';
import { escapeHtml } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { sourceMeta } from '../services/api.js';
import { confirmAction, showToast } from './ui.js';

export function renderCityList(container, emptyContainer, { cities, onSelect, onDelete, onMove, onAdd, onUseLocation }) {
  container.innerHTML = '';
  if (!cities.length) {
    container.hidden = true;
    emptyContainer.hidden = false;
    emptyContainer.innerHTML = `
      <div class="city-empty">
        <h2>${escapeHtml(PT.i18n.t('web.noCities'))}</h2>
        <div class="btn-row">
          <button class="btn" type="button" data-empty-add>${iconSvg('add', { size: 18 })} ${escapeHtml(PT.i18n.t('web.addCity'))}</button>
          <button class="btn btn--ghost" type="button" data-empty-location>${iconSvg('location', { size: 18 })} ${escapeHtml(PT.i18n.t('web.useLocation'))}</button>
        </div>
      </div>
    `;
    emptyContainer.querySelector('[data-empty-add]')?.addEventListener('click', onAdd);
    emptyContainer.querySelector('[data-empty-location]')?.addEventListener('click', onUseLocation);
    return;
  }

  container.hidden = false;
  emptyContainer.hidden = true;

  cities.forEach((city, index) => {
    const row = document.createElement('div');
    row.className = 'city-row';
    row.dataset.key = city.key;
    row.innerHTML = `
      <button class="city-row__main" type="button" data-select>
        <span class="city-row__name">${escapeHtml(city.name)}</span>
        <span class="city-row__source">${city.autoLocation ? `${iconSvg('location', { size: 14 })} ` : ''}${escapeHtml(sourceMeta(city.provider).label)}</span>
      </button>
      <div class="city-row__actions">
        <button class="icon-btn icon-btn--dark" type="button" data-up aria-label="${escapeHtml(PT.i18n.t('web.moveUp'))}" ${index === 0 ? 'disabled' : ''}>${iconSvg('arrow-up', { size: 20 })}</button>
        <button class="icon-btn icon-btn--dark" type="button" data-down aria-label="${escapeHtml(PT.i18n.t('web.moveDown'))}" ${index === cities.length - 1 ? 'disabled' : ''}>${iconSvg('arrow-down', { size: 20 })}</button>
        <button class="icon-btn icon-btn--dark" type="button" data-delete aria-label="${escapeHtml(PT.i18n.t('delete'))}">${iconSvg('delete', { size: 20 })}</button>
      </div>
    `;
    row.querySelector('[data-select]')?.addEventListener('click', () => onSelect(city, index));
    row.querySelector('[data-up]')?.addEventListener('click', () => onMove(city, -1));
    row.querySelector('[data-down]')?.addEventListener('click', () => onMove(city, 1));
    row.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: PT.i18n.t('web.removeCity'),
        message: PT.i18n.format(PT.i18n.t('web.removeCityConfirm'), [city.name]),
        confirmText: PT.i18n.t('delete'),
      });
      if (ok) {
        await onDelete(city);
        showToast(PT.i18n.t('web.removeCity'));
      }
    });
    container.appendChild(row);
  });
}
