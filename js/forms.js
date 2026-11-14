// アプリ・タスクの追加と編集のポップアップ、タスクの行と詳細
import { formatDate, t } from './i18n.js';
import { fileToIcon } from './images.js';
import * as S from './state.js';
import { flowFromNames, flowOf, flowProgress, logicalDate, uuid } from './store.js';
import { actionSheet, appIconEl, confirmDialog, field, h, icon, openSheet, progressRing, toast } from './ui.js';

// ---- フローの編集（ステップの名前の並び。追加・削除・名前の変更） ----
// steps: [{ id, name, doneAt }]。get() は今の入力。onTouch は利用者が触ったときに呼ぶ
function flowEditor(steps, { onTouch } = {}) {
  let rows = [];
  const list = h('div', { class: 'flow-edit' });
  const addRow = (st, focus) => {
    const input = h('input', { type: 'text', value: st.name, placeholder: t('flow.stepPlaceholder'), enterkeyhint: 'done', maxlength: '60' });
    const row = h('div', { class: 'flow-edit-row' },
      h('span', { class: 'flow-edit-no' }, ''),
      input,
      h('button', { type: 'button', class: 'flow-edit-del', 'aria-label': t('common.delete'), onClick: () => {
        rows = rows.filter((r) => r.row !== row);
        row.remove();
        number();
        onTouch?.();
        list.dispatchEvent(new Event('input', { bubbles: true }));
      } }, icon('minusCircle', 22)));
    rows.push({ row, input, st });
    list.insertBefore(row, addBtn);
    number();
    if (focus) input.focus();
  };
  const number = () => rows.forEach((r, i) => (r.row.firstChild.textContent = i + 1));
  const addBtn = h('button', { type: 'button', class: 'flow-edit-add', 'aria-label': t('flow.addStep'), onClick: () => {
    addRow({ id: uuid(), name: '', doneAt: null }, true);
    onTouch?.();
  } }, icon('plusCircle', 22), h('span', {}, t('flow.addStep')));
  list.append(addBtn);
  list.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') onTouch?.();
  });
  const set = (next) => {
    rows.forEach((r) => r.row.remove());
    rows = [];
    next.forEach((st) => addRow(st, false));
  };
  set(steps);
  return {
    el: list,
    set,
    get: () => rows.map((r) => ({ ...r.st, name: r.input.value.trim() })).filter((st) => st.name),
  };
}

const flowKey = (steps) => JSON.stringify(steps.map((st) => st.name));

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
  const flowStart = flowFromNames(app?.defaultFlow);
  const flow = flowEditor(flowStart);
  const read = () => ({
    ...v,
    name: name.value.trim(),
    description: desc.value.trim(),
    purpose: purpose.value.trim(),
    url: url.value.trim(),
    defaultFlow: flow.get().map((st) => st.name),
  });

  const body = h('div', { class: 'form' },
    h('div', { class: 'group' }, field(t('app.name'), name)),
    h('div', { class: 'group' },
      iconPicker(t('app.iconLight'), v.iconLight, (s) => (v.iconLight = s)),
      iconPicker(t('app.iconDark'), v.iconDark, (s) => (v.iconDark = s))),
    h('div', { class: 'group-note' }, t('app.iconHint')),
    h('div', { class: 'group' }, field(t('app.description'), desc), field(t('app.purpose'), purpose)),
    h('div', { class: 'group' }, field(t('app.url'), url)),
    h('div', { class: 'group-title' }, t('flow.default')),
    h('div', { class: 'group' }, flow.el),
    h('div', { class: 'group-note' }, t('flow.defaultHint')),
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
    dirty: () => {
      const { defaultFlow, ...rest } = read();
      return JSON.stringify({ ...rest, name: name.value, description: desc.value, purpose: purpose.value, url: url.value }) !== start
        || flowKey(flow.get()) !== flowKey(flowStart);
    },
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
  // 新しいタスクは、選んだアプリの標準フローから始める。自分でフローを触ったら、アプリを変えても入れ替えない
  let flowTouched = false;
  const flowStart = task ? flowOf(task) : flowFromNames(S.appById(selected)?.defaultFlow);
  const flow = flowEditor(flowStart, { onTouch: () => (flowTouched = true) });
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
          if (!task && !flowTouched) flow.set(flowFromNames(a.defaultFlow));
          drawChoices();
          list.dispatchEvent(new Event('input', { bubbles: true }));
        },
      }, appIconEl(a, 'sm'), h('span', { class: 'app-choice-name' }, a.name), a.id === selected && icon('check', 20))));
  };
  drawChoices();
  const body = h('div', { class: 'form' },
    h('div', { class: 'group-title' }, t('task.app')),
    h('div', { class: 'group' }, list),
    h('div', { class: 'group' }, field(t('task.title'), title), field(t('task.description'), desc)),
    h('div', { class: 'group-title' }, t('flow.title')),
    h('div', { class: 'group' }, flow.el));
  openSheet({
    title: task ? t('task.editTitle') : t('task.addTitle'),
    body,
    canSave: () => !!selected && title.value.trim() !== '',
    dirty: () => selected !== start.appId || title.value !== start.title || desc.value !== start.description
      || (flowTouched && flowKey(flow.get()) !== flowKey(flowStart)),
    onSave: async () => {
      const fields = { appId: selected, title: title.value.trim(), description: desc.value.trim(), flow: flow.get() };
      if (task) await S.updateTask(task.id, fields);
      else await S.addTask(fields);
    },
  });
  if (!task && selected) setTimeout(() => title.focus(), 250);
}

const isoToDate = (iso) => formatDate(logicalDate(new Date(iso)));

export function openTaskDetail(task) {
  let sheet;
  let current = task;
  const editBtn = h('button', { type: 'button', class: 'sheet-action strong', onClick: () => {
    sheet.close();
    openTaskForm({ task: current });
  } }, t('common.edit'));
  // ステップを押したら、ポップアップを開いたまま中身を描き直す
  const redraw = () => {
    current = S.state.tasks.find((x) => x.id === task.id);
    if (current) sheet.el.querySelector('.sheet-body').replaceChildren(detailBody(current, sheet, redraw));
  };
  sheet = openSheet({ title: t('tab.tasks'), body: h('div'), headerRight: editBtn });
  redraw();
}

function detailBody(task, sheet, redraw) {
  const app = S.appById(task.appId);
  const hasFlow = flowOf(task).length > 0;
  return h('div', { class: 'form' },
    h('div', { class: 'task-detail-app' }, appIconEl(app, 'sm'), h('span', {}, app.name)),
    h('h2', { class: `task-detail-title${task.completedAt ? ' done' : ''}` }, task.title),
    task.description && h('p', { class: 'task-detail-desc' }, task.description),
    hasFlow && h('div', { class: 'detail-flow' }, progressRing(flowProgress(task).ratio, 28, flowLabel(task)), stepChips(task, redraw)),
    h('div', { class: 'group' },
      h('div', { class: 'row', 'aria-label': t('task.created') }, icon('plusCircle', 20), h('span', { class: 'row-label' }, isoToDate(task.createdAt))),
      task.completedDate && h('div', { class: 'row', 'aria-label': t('task.completed') }, icon('checkCircle', 20), h('span', { class: 'row-label' }, formatDate(task.completedDate)))),
    h('div', { class: 'group' },
      !hasFlow && h('button', { type: 'button', class: 'row-btn', onClick: async () => {
        sheet.close();
        await S.toggleTask(task.id);
      } }, task.completedAt ? t('task.reopen') : t('task.complete')),
      h('button', { type: 'button', class: 'row-btn danger', onClick: () => deleteTaskFlow(task, () => sheet.close()) }, t('common.delete'))));
}

async function deleteTaskFlow(task, after) {
  if (!(await confirmDialog(t('task.deleteConfirm'), t('common.delete'), true))) return;
  after?.();
  await S.removeTask(task.id);
}

const flowLabel = (task) => {
  const { done, total } = flowProgress(task);
  return t('flow.progress', { done, total });
};

// フローのステップ。押すたびに済み／未済みが切り替わる。after は切り替えたあとに呼ぶ（詳細の描き直し）
function stepChips(task, after) {
  return h('div', { class: 'steps' }, flowOf(task).map((st) =>
    h('button', {
      type: 'button', class: `step${st.doneAt ? ' on' : ''}`, 'aria-pressed': String(!!st.doneAt),
      onClick: async () => {
        await S.toggleTaskStep(task.id, st.id);
        after?.();
      },
    }, icon(st.doneAt ? 'checkCircle' : 'circle', 16), h('span', {}, st.name))));
}

// タスクの1行。showDate なら完了日を出す（完了済みの一覧）
// フローがあるタスクは、左の円が進み具合（○→●）を表すだけで押せない。下のステップを押して進める
export function taskRow(task, { showDate = false } = {}) {
  const done = !!task.completedAt;
  const hasFlow = flowOf(task).length > 0;
  return h('div', { class: `task${done ? ' done' : ''}${hasFlow ? ' has-flow' : ''}` },
    hasFlow
      ? h('div', { class: 'task-ring' }, progressRing(flowProgress(task).ratio, 26, flowLabel(task)))
      : h('button', {
        type: 'button', class: 'task-check', role: 'checkbox', 'aria-checked': String(done),
        'aria-label': done ? t('task.reopen') : t('task.complete'),
        onClick: () => S.toggleTask(task.id),
      }, done && icon('check', 16)),
    h('div', { class: 'task-main' },
      h('button', { type: 'button', class: 'task-open', onClick: () => openTaskDetail(task) },
        h('span', { class: 'task-title' }, task.title),
        task.description && h('span', { class: 'task-desc' }, task.description),
        showDate && task.completedDate && h('span', { class: 'task-date', 'aria-label': t('task.doneOn', { date: formatDate(task.completedDate) }) }, icon('checkCircle', 14), formatDate(task.completedDate))),
      hasFlow && stepChips(task)),
    h('button', {
      type: 'button', class: 'task-more', 'aria-label': '…',
      onClick: () => actionSheet([
        { label: t('common.edit'), onSelect: () => openTaskForm({ task }) },
        { label: t('common.delete'), danger: true, onSelect: () => deleteTaskFlow(task) },
      ], task.title),
    }, icon('more', 22)));
}
