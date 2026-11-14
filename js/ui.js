// 画面の部品：要素を作る h()、アイコン、ポップアップ（シート）、確認、メニュー、トースト
import { t } from './i18n.js';
import { appIcon, initial } from './store.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 右上の「＋」のバッジ。下の図形との間に背景色のすき間をあけ、塗った丸の中に＋を抜く（色は style.css）
// マークは中心（12, 12）に置き、バッジはその右上の角に重ねる（枠の外にはみ出すので .fab svg は overflow: visible）
const PLUS_BADGE = '<circle class="badge-gap" cx="19.5" cy="4.5" r="6" stroke="none"/><circle cx="19.5" cy="4.5" r="4.7" fill="currentColor" stroke="none"/><path class="badge-plus" d="M19.5 2.3v4.4M17.3 4.5h4.4" stroke-width="1.9"/>';

// 線のアイコン（24×24）。tool は Feather Icons（MIT）のスパナ
const PATHS = {
  library: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  // 追加ボタン：アプリのマーク（角丸の四角）／スパナの右上に「＋」のバッジ
  addApp: `<rect x="4" y="4" width="16" height="16" rx="4.5"/>${PLUS_BADGE}`,
  addTask: `<g transform="translate(22.4 1.8) scale(-.86 .86)" stroke-width="2.1"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></g>${PLUS_BADGE}`,
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16 9.7"/>',
  minusCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>',
  plusCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
};

export function icon(name, size = 24) {
  const s = h('span', { class: 'icon', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
  return s;
}

// 進み具合の円。12時の位置から時計回りに塗り、全部済むと ●（ratio は 0〜1）
export function progressRing(ratio, size = 26, label = '') {
  const r = 9;
  const c = 12;
  let fill = '';
  if (ratio >= 1) fill = `<circle cx="${c}" cy="${c}" r="${r}" fill="currentColor"/>`;
  else if (ratio > 0) {
    const a = ratio * 2 * Math.PI;
    const x = (c + r * Math.sin(a)).toFixed(3);
    const y = (c - r * Math.cos(a)).toFixed(3);
    fill = `<path d="M${c} ${c}L${c} ${c - r}A${r} ${r} 0 ${ratio > 0.5 ? 1 : 0} 1 ${x} ${y}Z" fill="currentColor"/>`;
  }
  const s = h('span', { class: 'ring', role: 'img', 'aria-label': label });
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${fill}<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
  return s;
}

export const isDark = () => document.documentElement.dataset.theme === 'dark';

// アプリのアイコン（画像がなければ頭文字）
export function appIconEl(app, size = 'md') {
  const src = appIcon(app, isDark());
  return src
    ? h('img', { class: `app-icon ${size}`, src, alt: '', draggable: 'false' })
    : h('div', { class: `app-icon ${size} letter`, 'aria-hidden': 'true' }, initial(app.name));
}

export function fab(iconName, label, onClick) {
  return h('button', { type: 'button', class: 'fab', 'aria-label': label, onClick }, icon(iconName, 28));
}

// ---- 重ねて出す画面 ----

const layer = () => document.getElementById('layer');

function backdrop(className, onOutside) {
  const bd = h('div', { class: `backdrop ${className}` });
  bd.addEventListener('click', (e) => {
    if (e.target === bd) onOutside();
  });
  layer().append(bd);
  requestAnimationFrame(() => bd.classList.add('show'));
  return bd;
}

function removeLayer(bd) {
  bd.classList.remove('show');
  setTimeout(() => bd.remove(), 220);
}

// 下から出るシート。canSave() が false のあいだは保存できない。dirty() が true なら閉じる前に確かめる
export function openSheet({ title, body, onSave, canSave = () => true, dirty = () => false, saveLabel, headerRight }) {
  let saveBtn;
  const close = () => removeLayer(bd);
  const tryClose = async () => {
    if (dirty() && !(await confirmDialog(t('common.discardTitle'), t('common.discard'), true))) return;
    close();
  };
  const refresh = () => {
    if (saveBtn) saveBtn.disabled = !canSave();
  };
  const bd = backdrop('sheet-bd', tryClose);
  if (onSave) {
    saveBtn = h('button', { type: 'button', class: 'sheet-action strong', onClick: async () => {
      if (!canSave()) return;
      saveBtn.disabled = true;
      try {
        if ((await onSave()) !== false) close();
      } finally {
        refresh();
      }
    } }, saveLabel || t('common.save'));
  }
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': t('common.close'), onClick: tryClose }, icon('close', 22)),
      h('div', { class: 'sheet-title' }, title),
      saveBtn || headerRight || h('span', { class: 'sheet-spacer' })),
    h('div', { class: 'sheet-body' }, body));
  sheet.addEventListener('input', refresh);
  sheet.addEventListener('change', refresh);
  bd.append(sheet);
  refresh();
  return { close, refresh, el: sheet };
}

// 確認。OK なら true
export function confirmDialog(message, okLabel, danger = false) {
  return new Promise((resolve) => {
    const done = (v) => {
      removeLayer(bd);
      resolve(v);
    };
    const bd = backdrop('dialog-bd', () => done(false));
    bd.append(h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
      h('div', { class: 'dialog-msg' }, message),
      h('div', { class: 'dialog-btns' },
        h('button', { type: 'button', onClick: () => done(false) }, t('common.cancel')),
        h('button', { type: 'button', class: danger ? 'danger strong' : 'strong', onClick: () => done(true) }, okLabel))));
  });
}

// 下から出るメニュー。items: [{ label, danger, onSelect }]
export function actionSheet(items, title) {
  const bd = backdrop('action-bd', () => removeLayer(bd));
  const pick = (fn) => () => {
    removeLayer(bd);
    fn?.();
  };
  bd.append(h('div', { class: 'action-sheet' },
    h('div', { class: 'action-group' },
      title && h('div', { class: 'action-title' }, title),
      items.map((it) => h('button', { type: 'button', class: it.danger ? 'danger' : '', onClick: pick(it.onSelect) }, it.label))),
    h('div', { class: 'action-group' },
      h('button', { type: 'button', class: 'strong', onClick: pick() }, t('common.cancel')))));
}

export function toast(message) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// 入力欄をまとめた iOS 風のグループ
export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint && h('span', { class: 'field-hint' }, hint));
}
