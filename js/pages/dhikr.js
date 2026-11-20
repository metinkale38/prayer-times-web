import { PT } from '../boot.js';
import { debounce, escapeHtml } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { DHIKR_COLORS } from '../services/dhikr.js';
import { confirmAction, closeDialog, openDialog, showToast } from '../components/ui.js';

await PT.ready;
await PT.shellReady;

const select = document.getElementById('dhikr-select');
const addButton = document.getElementById('dhikr-add');
const deleteButton = document.getElementById('dhikr-delete');
const titleInput = document.getElementById('dhikr-title');
const circle = document.getElementById('dhikr-circle');
const countEl = document.getElementById('dhikr-count');
const targetEl = document.getElementById('dhikr-target');
const roundsEl = document.getElementById('dhikr-rounds');
const ring = document.getElementById('dhikr-ring-value');
const resetButton = document.getElementById('dhikr-reset');
const vibrateButton = document.getElementById('dhikr-vibrate');
const colorsEl = document.getElementById('dhikr-colors');

const CIRCUMFERENCE = 2 * Math.PI * 47;
let currentId = null;
let suppressClick = false;
let longPressTimer = 0;

function items() {
  return PT.dhikr.all();
}

function current() {
  return currentId ? PT.dhikr.get(currentId) : items()[0] || null;
}

function vibrateMode() {
  return Number(PT.settings.get('vibration', 1));
}

function haptic() {
  const mode = vibrateMode();
  if (!navigator.vibrate || mode === 0) return;
  navigator.vibrate(mode === 2 ? [0, 25, 35, 25] : 12);
}

function hapticTarget() {
  const mode = vibrateMode();
  if (!navigator.vibrate || mode === 0) return;
  navigator.vibrate(mode === 2 ? [0, 100, 100, 100, 100, 100] : [0, 60, 60, 60]);
}

function renderColors(item) {
  colorsEl.innerHTML = DHIKR_COLORS.map((color) => `
    <button class="dhikr-color" type="button" style="background:${color}" data-color="${color}" aria-label="${escapeHtml(PT.i18n.t('web.color'))} ${color}" aria-pressed="${item.color === color}"></button>
  `).join('');
  colorsEl.querySelectorAll('[data-color]').forEach((button) => {
    button.addEventListener('click', async () => {
      await PT.dhikr.update(item.id, { color: button.dataset.color });
      render();
    });
  });
}

function renderVibrate() {
  const mode = vibrateMode();
  const labels = ['web.vibrationOff', 'web.vibrationSoft', 'web.vibrationStrong'];
  vibrateButton.dataset.mode = mode === 0 ? 'off' : 'on';
  vibrateButton.setAttribute('aria-label', `${PT.i18n.t('web.vibration')}: ${PT.i18n.t(labels[mode] || labels[1])}`);
  vibrateButton.title = `${PT.i18n.t('web.vibration')}: ${PT.i18n.t(labels[mode] || labels[1])}`;
}

function render() {
  const list = items();
  if (!list.length) return;
  let item = current();
  if (!item) {
    currentId = list[0].id;
    item = list[0];
  }

  select.innerHTML = list.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</option>`).join('');
  select.value = item.id;
  select.setAttribute('aria-label', PT.i18n.t('web.selectDhikr'));
  titleInput.setAttribute('aria-label', PT.i18n.t('web.dhikrName'));
  roundsEl.title = PT.i18n.t('web.rounds');

  if (document.activeElement !== titleInput) titleInput.value = item.title;
  titleInput.placeholder = PT.i18n.t('web.dhikrTitle');

  const numbers = PT.settings.get('numbers', 'normal');
  const mod = item.value % item.target;
  countEl.textContent = PT.i18n.number(mod, numbers);
  targetEl.textContent = `/${PT.i18n.number(item.target, numbers)}`;
  roundsEl.textContent = PT.i18n.number(Math.floor(item.value / item.target), numbers);
  const progress = item.target > 0 ? mod / item.target : 0;
  ring.style.strokeDasharray = `${CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${CIRCUMFERENCE * (1 - progress)}`;
  ring.style.stroke = item.color;
  renderColors(item);
  renderVibrate();
  history.replaceState(null, '', `${location.pathname}${location.search}#dhikr=${encodeURIComponent(item.id)}`);
}

async function increment() {
  const item = current();
  if (!item) return;
  const next = item.value + 1;
  await PT.dhikr.increment(item.id);
  render();
  if (next % item.target === 0) hapticTarget();
  else haptic();
}

function selectDhikr(id) {
  currentId = id;
  render();
}

function openAddDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${escapeHtml(PT.i18n.t('web.addDhikr'))}</div>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="modal__body">
      <div class="stack">
        <div class="field">
          <label for="new-dhikr-title">${escapeHtml(PT.i18n.t('web.dhikrTitle'))}</label>
          <input class="input" id="new-dhikr-title" maxlength="20" value="${escapeHtml(PT.i18n.t('newDhikr'))}">
        </div>
        <div class="field">
          <label for="new-dhikr-target">${escapeHtml(PT.i18n.t('web.dhikrTarget'))}</label>
          <input class="input" id="new-dhikr-target" type="number" min="1" max="100000" value="33">
        </div>
        <div class="modal__actions">
          <button class="btn btn--text" type="button" data-close>${escapeHtml(PT.i18n.t('cancel'))}</button>
          <button class="btn" type="button" data-save>${escapeHtml(PT.i18n.t('web.save'))}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => { closeDialog(dialog); dialog.remove(); };
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.querySelector('[data-save]').addEventListener('click', async () => {
    const title = dialog.querySelector('#new-dhikr-title').value.trim() || PT.i18n.t('tasbih');
    const target = Math.max(1, Number(dialog.querySelector('#new-dhikr-target').value || 33));
    const item = await PT.dhikr.add({ title, target, color: current()?.color || DHIKR_COLORS[0] });
    currentId = item.id;
    close();
    render();
  });
  openDialog(dialog);
  window.setTimeout(() => dialog.querySelector('#new-dhikr-title')?.select(), 60);
}

function openTargetDialog() {
  const item = current();
  if (!item) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${escapeHtml(PT.i18n.t('web.dhikrTarget'))}</div>
      <button class="icon-btn" type="button" data-close aria-label="${escapeHtml(PT.i18n.t('web.close'))}">${iconSvg('close')}</button>
    </div>
    <div class="modal__body">
      <div class="field">
        <label for="edit-dhikr-target">${escapeHtml(PT.i18n.t('web.dhikrTarget'))}</label>
        <input class="input" id="edit-dhikr-target" type="number" min="1" max="100000" value="${item.target}">
      </div>
      <div class="modal__actions">
        <button class="btn btn--text" type="button" data-close>${escapeHtml(PT.i18n.t('cancel'))}</button>
        <button class="btn" type="button" data-save>${escapeHtml(PT.i18n.t('web.save'))}</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => { closeDialog(dialog); dialog.remove(); };
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.querySelector('[data-save]').addEventListener('click', async () => {
    const target = Math.max(1, Number(dialog.querySelector('#edit-dhikr-target').value || item.target));
    await PT.dhikr.update(item.id, { target });
    close();
    render();
  });
  openDialog(dialog);
  window.setTimeout(() => dialog.querySelector('#edit-dhikr-target')?.select(), 60);
}

circle.addEventListener('click', () => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  increment();
});

circle.addEventListener('pointerdown', () => {
  clearTimeout(longPressTimer);
  longPressTimer = window.setTimeout(() => {
    suppressClick = true;
    openTargetDialog();
  }, 650);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
  circle.addEventListener(eventName, () => clearTimeout(longPressTimer));
});

circle.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  openTargetDialog();
});

select.addEventListener('change', () => {
  currentId = select.value;
  render();
});

const saveTitle = debounce(async () => {
  const item = current();
  if (!item) return;
  const title = titleInput.value.trim().slice(0, 20);
  if (!title || title === item.title) return;
  await PT.dhikr.update(item.id, { title });
  render();
}, 450);

titleInput.addEventListener('input', saveTitle);
titleInput.addEventListener('change', () => { saveTitle.cancel?.(); saveTitle(); });

addButton?.addEventListener('click', openAddDialog);

deleteButton?.addEventListener('click', async () => {
  const item = current();
  if (!item) return;
  const ok = await confirmAction({
    title: PT.i18n.t('web.deleteDhikr'),
    message: PT.i18n.format(PT.i18n.t('web.deleteDhikrConfirm'), [item.title]),
    confirmText: PT.i18n.t('delete'),
  });
  if (!ok) return;
  await PT.dhikr.remove(item.id);
  currentId = items()[0]?.id || null;
  render();
});

resetButton?.addEventListener('click', async () => {
  const item = current();
  if (!item) return;
  const ok = await confirmAction({
    title: PT.i18n.t('web.reset'),
    message: PT.i18n.format(PT.i18n.t('resetConfirmDhikr'), [item.title]),
    confirmText: PT.i18n.t('yes'),
    danger: false,
  });
  if (!ok) return;
  await PT.dhikr.reset(item.id);
  render();
});

vibrateButton?.addEventListener('click', async () => {
  const next = (vibrateMode() + 1) % 3;
  await PT.settings.set('vibration', next);
  renderVibrate();
  const labels = ['web.vibrationOff', 'web.vibrationSoft', 'web.vibrationStrong'];
  showToast(PT.i18n.t(labels[next]));
});

function initialId() {
  const hash = location.hash;
  if (hash.startsWith('#dhikr=')) return decodeURIComponent(hash.slice(7));
  return null;
}

const initial = initialId();
currentId = initial && PT.dhikr.get(initial) ? initial : (items()[0]?.id || null);
render();
