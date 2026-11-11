// アプリ・タスクの追加と編集のポップアップ、タスクの行と詳細
import { formatDate, t } from './i18n.js';
import { fileToIcon } from './images.js';
import * as S from './state.js';
import { logicalDate } from './store.js';
import { actionSheet, appIconEl, confirmDialog, field, h, icon, openSheet, toast } from './ui.js';

// ---- アプリ ----

function iconPicker(label, initialSrc, onPick) {
  let src = initialSrc;
  const preview = h('div', { class: 'icon-preview' });
  const input = h('input', { type: 'file', accept: 'image/*', class: 'hidden-input' });
  const removeBtn = h('button', { type: 'button', class: 'link-btn danger' }, t('app.iconRemove'));
  const draw = () => {
    preview.replaceChildren(src ? h('img', { class: 'app-icon md', src, alt: '' }) : h('div', { class: 'app-icon md empty' }));
    removeBtn.hidden = !src;
  };
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      src = await fileToIcon(file);
      onPick(src);
      draw();
      preview.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {
      toast(t('app.imageError'));
    }
  });
  removeBtn.addEventListener('click', () => {
    src = null;
    onPick(null);
    draw();
    preview.dispatchEvent(new Event('input', { bubbles: true }));
  });
  draw();
  return h('div', { class: 'icon-picker' },
    preview,
    h('div', { class: 'icon-picker-text' },
      h('div', { class: 'icon-picker-label' }, label),
      h('div', { class: 'icon-picker-btns' },
        h('button', { type: 'button', class: 'link-btn', onClick: () => input.click() }, t('app.iconChoose')),
        removeBtn)),
    input);
}

export function openAppForm(app) {
  const v = {
    name: app?.name ?? '',
    iconLight: app?.iconLight ?? null,
    iconDark: app?.iconDark ?? null,
    description: app?.description ?? '',
    purpose: app?.purpose ?? '',
    url: app?.url ?? '',
  };
  const start = JSON.stringify(v);
  const name = h('input', { type: 'text', value: v.name, placeholder: t('app.namePlaceholder'), enterkeyhint: 'done', maxlength: '100' });
  const desc = h('textarea', { rows: '3', value: v.description, placeholder: t('app.descriptionPlaceholder') });
  const purpose = h('textarea', { rows: '3', value: v.purpose, placeholder: t('app.purposePlaceholder') });
  const url = h('input', { type: 'url', value: v.url, placeholder: t('app.urlPlaceholder'), inputmode: 'url', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  const read = () => ({
    ...v,
    name: name.value.trim(),
    description: desc.value.trim(),
    purpose: purpose.value.trim(),
    url: url.value.trim(),
  });

  const body = h('div', { class: 'form' },
    h('div', { class: 'group' }, field(t('app.name'), name)),
    h('div', { class: 'group' },
      iconPicker(t('app.iconLight'), v.iconLight, (s) => (v.iconLight = s)),
      iconPicker(t('app.iconDark'), v.iconDark, (s) => (v.iconDark = s))),
    h('div', { class: 'group-note' }, t('app.iconHint')),
    h('div', { class: 'group' }, field(t('app.description'), desc), field(t('app.purpose'), purpose)),
    h('div', { class: 'group' }, field(t('app.url'), url)),
    app && h('div', { class: 'group' },
      h('button', { type: 'button', class: 'row-btn danger', onClick: async () => {
        const n = S.tasksOf(app.id).length;
        if (!(await confirmDialog(t('app.deleteConfirm', { n }), t('common.delete'), true))) return;
        sheet.close();
        S.state.ui.detailId = null;
        await S.removeApp(app.id);
      } }, t('app.delete'))));

  const sheet = openSheet({
    title: app ? t('app.editTitle') : t('app.addTitle'),
    body,
    canSave: () => name.value.trim() !== '',
    dirty: () => JSON.stringify({ ...read(), name: name.value, description: desc.value, purpose: purpose.value, url: url.value }) !== start,
    onSave: async () => {
      if (app) await S.updateApp(app.id, read());
      else await S.addApp(read());
    },
  });
  if (!app) setTimeout(() => name.focus(), 250);
}

// ---- タスク ----

export function openTaskForm({ task, appId } = {}) {
  if (!S.state.apps.length) {
    const sheet = openSheet({
      title: t('task.addTitle'),
      body: h('div', { class: 'need-app' },
        h('p', {}, t('task.needApp')),
        h('button', { type: 'button', class: 'primary-btn', onClick: () => {
          sheet.close();
          S.state.ui.tab = 'library';
          S.state.ui.detailId = null;
          S.render();
        } }, t('task.goLibrary'))),
    });
    return;
  }
  let selected = task?.appId ?? appId ?? null;
  const start = { appId: selected, title: task?.title ?? '', description: task?.description ?? '' };
  const title = h('input', { type: 'text', value: start.title, placeholder: t('task.titlePlaceholder'), enterkeyhint: 'done', maxlength: '200' });
  const desc = h('textarea', { rows: '4', value: start.description, placeholder: t('task.descriptionPlaceholder') });
  const list = h('div', { class: 'app-choices', role: 'radiogroup', 'aria-label': t('task.app') });
  const drawChoices = () => {
    list.replaceChildren(...S.state.apps.map((a) =>
      h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(a.id === selected),
        class: `app-choice${a.id === selected ? ' on' : ''}`,
        onClick: () => {
          selected = a.id;
          drawChoices();
          list.dispatchEvent(new Event('input', { bubbles: true }));
        },
      }, appIconEl(a, 'sm'), h('span', { class: 'app-choice-name' }, a.name), a.id === selected && icon('check', 20))));
  };
  drawChoices();
  const body = h('div', { class: 'form' },
    h('div', { class: 'group-title' }, t('task.app')),
    h('div', { class: 'group' }, list),
    h('div', { class: 'group' }, field(t('task.title'), title), field(t('task.description'), desc)));
  openSheet({
    title: task ? t('task.editTitle') : t('task.addTitle'),
    body,
    canSave: () => !!selected && title.value.trim() !== '',
    dirty: () => selected !== start.appId || title.value !== start.title || desc.value !== start.description,
    onSave: async () => {
      const fields = { appId: selected, title: title.value.trim(), description: desc.value.trim() };
      if (task) await S.updateTask(task.id, fields);
      else await S.addTask(fields);
    },
  });
  if (!task && selected) setTimeout(() => title.focus(), 250);
}

const isoToDate = (iso) => formatDate(logicalDate(new Date(iso)));

export function openTaskDetail(task) {
  const app = S.appById(task.appId);
  let sheet;
  const editBtn = h('button', { type: 'button', class: 'sheet-action strong', onClick: () => {
    sheet.close();
    openTaskForm({ task });
  } }, t('common.edit'));
  const body = h('div', { class: 'form' },
    h('div', { class: 'task-detail-app' }, appIconEl(app, 'sm'), h('span', {}, app.name)),
    h('h2', { class: `task-detail-title${task.completedAt ? ' done' : ''}` }, task.title),
    task.description && h('p', { class: 'task-detail-desc' }, task.description),
    h('div', { class: 'group' },
      h('div', { class: 'row', 'aria-label': t('task.created') }, icon('plusCircle', 20), h('span', { class: 'row-label' }, isoToDate(task.createdAt))),
      task.completedDate && h('div', { class: 'row', 'aria-label': t('task.completed') }, icon('checkCircle', 20), h('span', { class: 'row-label' }, formatDate(task.completedDate)))),
    h('div', { class: 'group' },
      h('button', { type: 'button', class: 'row-btn', onClick: async () => {
        sheet.close();
        await S.toggleTask(task.id);
      } }, task.completedAt ? t('task.reopen') : t('task.complete')),
      h('button', { type: 'button', class: 'row-btn danger', onClick: () => deleteTaskFlow(task, () => sheet.close()) }, t('common.delete'))));
  sheet = openSheet({ title: t('tab.tasks'), body, headerRight: editBtn });
}

async function deleteTaskFlow(task, after) {
  if (!(await confirmDialog(t('task.deleteConfirm'), t('common.delete'), true))) return;
  after?.();
  await S.removeTask(task.id);
}

// タスクの1行。showDate なら完了日を出す（完了済みの一覧）
export function taskRow(task, { showDate = false } = {}) {
  const done = !!task.completedAt;
  return h('div', { class: `task${done ? ' done' : ''}` },
    h('button', {
      type: 'button', class: 'task-check', role: 'checkbox', 'aria-checked': String(done),
      'aria-label': done ? t('task.reopen') : t('task.complete'),
      onClick: () => S.toggleTask(task.id),
    }, done && icon('check', 16)),
    h('button', { type: 'button', class: 'task-main', onClick: () => openTaskDetail(task) },
      h('span', { class: 'task-title' }, task.title),
      task.description && h('span', { class: 'task-desc' }, task.description),
      showDate && task.completedDate && h('span', { class: 'task-date', 'aria-label': t('task.doneOn', { date: formatDate(task.completedDate) }) }, icon('checkCircle', 14), formatDate(task.completedDate))),
    h('button', {
      type: 'button', class: 'task-more', 'aria-label': '…',
      onClick: () => actionSheet([
        { label: t('common.edit'), onSelect: () => openTaskForm({ task }) },
        { label: t('common.delete'), danger: true, onSelect: () => deleteTaskFlow(task) },
      ], task.title),
    }, icon('more', 22)));
}
