// ライブラリ：アプリのアイコンのグリッド（長押しで並べ替え）と、アプリ詳細
import { openAppForm, openTaskForm, taskRow } from '../forms.js';
import { t } from '../i18n.js';
import * as S from '../state.js';
import { doneTasks, hrefOf, openTasks } from '../store.js';
import { appIconEl, fab, h, icon } from '../ui.js';

export function libraryView() {
  const { ui, apps } = S.state;
  if (ui.detailId && S.appById(ui.detailId)) return detailView(S.appById(ui.detailId));
  ui.detailId = null;

  const grid = h('div', { class: 'grid' }, apps.map((app) =>
    h('button', { type: 'button', class: 'cell', 'data-id': app.id, onClick: (e) => {
      if (e.currentTarget.dataset.dragged) return;
      ui.detailId = app.id;
      S.render();
      document.getElementById('scroller').scrollTop = 0;
    } }, appIconEl(app, 'md'), h('span', { class: 'cell-name' }, app.name))));
  enableReorder(grid);

  return [
    h('header', { class: 'large-title' }, h('h1', {}, t('tab.library'))),
    installHint(),
    apps.length ? grid : h('div', { class: 'empty-msg' }, t('library.empty')),
    apps.length > 1 && h('div', { class: 'grid-hint' }, t('library.reorderHint')),
    fab('addApp', t('library.add'), () => openAppForm()),
  ];
}

function detailView(app) {
  const { ui, today } = S.state;
  const mine = S.tasksOf(app.id);
  const open = openTasks(mine, today);
  const done = doneTasks(mine, today, true);
  const info = (label, value) => value && h('div', { class: 'info' }, h('div', { class: 'info-label' }, label), h('div', { class: 'info-value' }, value));

  return [
    h('header', { class: 'nav-bar' },
      h('button', { type: 'button', class: 'nav-back', onClick: () => {
        ui.detailId = null;
        S.render();
      } }, icon('back', 22), t('common.back')),
      h('button', { type: 'button', class: 'nav-action', onClick: () => openAppForm(app) }, t('common.edit'))),
    h('section', { class: 'detail-head' },
      appIconEl(app, 'lg'),
      h('h1', { class: 'detail-name' }, app.name)),
    (app.description || app.purpose || app.url) && h('div', { class: 'group info-group' },
      info(t('app.description'), app.description),
      info(t('app.purpose'), app.purpose),
      app.url && h('a', { class: 'info link', href: hrefOf(app.url), target: '_blank', rel: 'noopener noreferrer' },
        icon('link', 18), h('span', { class: 'info-value' }, app.url))),
    h('div', { class: 'group-title' }, t('detail.open')),
    open.length
      ? h('div', { class: 'group tasks' }, open.map((tk) => taskRow(tk)))
      : h('div', { class: 'group-empty' }, t('detail.noOpen')),
    done.length > 0 && h('div', { class: 'group-title' }, t('detail.done')),
    done.length > 0 && h('div', { class: 'group tasks' }, done.map((tk) => taskRow(tk, { showDate: true }))),
    fab('addTask', t('task.addTitle'), () => openTaskForm({ appId: app.id })),
  ];
}

// ホーム画面に追加していないときの案内（閉じたら出さない）
function installHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let closed = false;
  try {
    closed = localStorage.getItem('devepatch.installHint') === 'closed';
  } catch { /* 保存できない環境では毎回出す */ }
  if (standalone || closed || location.protocol === 'file:') return null;
  const el = h('div', { class: 'hint' },
    h('span', {}, t('install.hint')),
    h('button', { type: 'button', class: 'hint-close', 'aria-label': t('common.close'), onClick: () => {
      try {
        localStorage.setItem('devepatch.installHint', 'closed');
      } catch { /* 無視 */ }
      el.remove();
    } }, icon('close', 18)));
  return el;
}

// ---- 長押しで並べ替え ----
const HOLD_MS = 400;
const MOVE_TOLERANCE = 10;

function enableReorder(grid) {
  let timer = null;
  let drag = null; // { el, offX, offY }
  let startX = 0;
  let startY = 0;

  const point = (e) => (e.touches ? e.touches[0] || e.changedTouches[0] : e);

  const begin = (el, p) => {
    const r = el.getBoundingClientRect();
    drag = { el, offX: p.clientX - r.left, offY: p.clientY - r.top };
    el.classList.add('dragging');
    grid.classList.add('reordering');
    navigator.vibrate?.(10);
  };

  const move = (p) => {
    const { el } = drag;
    const cells = [...grid.children];
    const over = cells.find((c) => {
      if (c === el) return false;
      const r = c.getBoundingClientRect();
      return p.clientX >= r.left && p.clientX <= r.right && p.clientY >= r.top && p.clientY <= r.bottom;
    });
    if (over) {
      const from = cells.indexOf(el);
      const to = cells.indexOf(over);
      grid.insertBefore(el, from < to ? over.nextSibling : over);
    }
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${p.clientX - drag.offX - r.left}px, ${p.clientY - drag.offY - r.top}px) scale(1.08)`;
  };

  const end = () => {
    clearTimeout(timer);
    timer = null;
    if (!drag) return;
    const { el } = drag;
    el.style.transform = '';
    el.classList.remove('dragging');
    grid.classList.remove('reordering');
    // 指を離したときのクリックで詳細を開かないようにする
    el.dataset.dragged = '1';
    setTimeout(() => delete el.dataset.dragged, 400);
    drag = null;
    const ids = [...grid.children].map((c) => c.dataset.id);
    S.saveOrder(ids);
  };

  const down = (e) => {
    const el = e.target.closest('.cell');
    if (!el || (e.button !== undefined && e.button !== 0)) return;
    const p = point(e);
    startX = p.clientX;
    startY = p.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => begin(el, p), HOLD_MS);
  };

  const moveHandler = (e) => {
    const p = point(e);
    if (drag) {
      e.preventDefault();
      move(p);
    } else if (timer && Math.hypot(p.clientX - startX, p.clientY - startY) > MOVE_TOLERANCE) {
      clearTimeout(timer);
      timer = null;
    }
  };

  grid.addEventListener('touchstart', down, { passive: true });
  grid.addEventListener('touchmove', moveHandler, { passive: false });
  grid.addEventListener('touchend', end);
  grid.addEventListener('touchcancel', end);
  grid.addEventListener('mousedown', (e) => {
    down(e);
    const mm = (ev) => moveHandler(ev);
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      end();
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
  grid.addEventListener('contextmenu', (e) => e.preventDefault());
}
