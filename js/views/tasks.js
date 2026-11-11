// タスク：アプリごとにまとめた一覧。上部でアプリと状態を絞り込む
import { openTaskForm, taskRow } from '../forms.js';
import { t } from '../i18n.js';
import * as S from '../state.js';
import { groupTasks } from '../store.js';
import { appIconEl, fab, h, icon } from '../ui.js';

export function tasksView() {
  const { ui, apps, tasks, today } = S.state;
  const f = ui.filter;
  if (f.appId !== 'all' && !S.appById(f.appId)) f.appId = 'all';

  const chip = (label, on, onClick, iconEl, iconOnly = false) =>
    h('button', {
      type: 'button', class: `chip${on ? ' on' : ''}${iconOnly ? ' icon-only' : ''}`, 'aria-pressed': String(on),
      'aria-label': iconOnly ? label : null, title: iconOnly ? label : null, onClick,
    }, iconEl, !iconOnly && label);

  const appChips = h('div', { class: 'chips scroll' },
    chip(t('tasks.all'), f.appId === 'all', () => {
      f.appId = 'all';
      S.render();
    }),
    apps.map((a) => chip(a.name, f.appId === a.id, () => {
      f.appId = a.id;
      S.render();
    }, appIconEl(a, 'xs'))));

  // 状態は少なくとも1つは選んだままにする
  const toggle = (key) => () => {
    const other = key === 'open' ? 'done' : 'open';
    if (f[key] && !f[other]) return;
    f[key] = !f[key];
    S.render();
  };
  const statusChips = h('div', { class: 'chips' },
    chip(t('tasks.open'), f.open, toggle('open'), icon('circle', 20), true),
    chip(t('tasks.done'), f.done, toggle('done'), icon('checkCircle', 20), true));

  const groups = groupTasks(apps, tasks, { ...f, today });

  return [
    h('header', { class: 'large-title' }, h('h1', {}, t('tab.tasks'))),
    apps.length > 0 && h('div', { class: 'filters' }, appChips, statusChips),
    groups.length
      ? groups.map((g) => [
        h('div', { class: 'app-heading' }, appIconEl(g.app, 'xs'), h('span', {}, g.app.name)),
        h('div', { class: 'group tasks' },
          g.open.map((tk) => taskRow(tk)),
          g.done.map((tk) => taskRow(tk, { showDate: true }))),
      ])
      : h('div', { class: 'empty-msg' }, icon('checkCircle', 56), h('div', {}, t('tasks.empty'))),
    fab('addTask', t('task.addTitle'), () => openTaskForm()),
  ];
}
