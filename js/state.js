// メモリ上のデータと、それを変える操作。変えたら保存して画面を描き直す
import * as db from './db.js';
import {
  DEFAULT_SETTINGS, completeTask, flowOf, logicalDate, mergeData, nextOrder, reopenTask, reorder, setFlow, sortApps, toggleStep, uuid,
} from './store.js';

export const state = {
  apps: [],
  tasks: [],
  settings: { ...DEFAULT_SETTINGS },
  today: logicalDate(),
  ui: {
    tab: 'library', // library | tasks | settings
    detailId: null, // 開いているアプリ詳細
    filter: { appId: 'all', open: true, done: false },
  },
};

let renderFn = () => {};
export const onChange = (fn) => {
  renderFn = fn;
};
export const render = () => renderFn();

export async function load() {
  const data = await db.loadAll();
  state.apps = sortApps(data.apps);
  state.tasks = data.tasks;
  state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
}

const now = () => new Date().toISOString();
export const appById = (id) => state.apps.find((a) => a.id === id);
export const tasksOf = (appId) => state.tasks.filter((t) => t.appId === appId);

export async function addApp(fields) {
  const at = now();
  const app = { id: uuid(), ...fields, order: nextOrder(state.apps), createdAt: at, updatedAt: at };
  await db.putApps([app]);
  state.apps = [...state.apps, app];
  render();
  return app;
}

export async function updateApp(id, fields) {
  const app = { ...appById(id), ...fields, updatedAt: now() };
  await db.putApps([app]);
  state.apps = state.apps.map((a) => (a.id === id ? app : a));
  render();
}

export async function removeApp(id) {
  const ids = tasksOf(id).map((t) => t.id);
  await db.deleteApp(id, ids);
  state.apps = state.apps.filter((a) => a.id !== id);
  state.tasks = state.tasks.filter((t) => t.appId !== id);
  if (state.ui.filter.appId === id) state.ui.filter.appId = 'all';
  render();
}

export async function saveOrder(ids) {
  const next = reorder(state.apps, ids);
  const changed = next.filter((a) => appById(a.id).order !== a.order);
  state.apps = next;
  if (changed.length) await db.putApps(changed);
  render();
}

export async function addTask({ appId, title, description, flow = [] }) {
  const at = now();
  const base = { id: uuid(), appId, title, description, flow: [], completedAt: null, completedDate: null, createdAt: at, updatedAt: at };
  const task = setFlow(base, flow);
  await db.putTask(task);
  state.tasks = [...state.tasks, task];
  render();
}

async function replaceTask(task) {
  await db.putTask(task);
  state.tasks = state.tasks.map((t) => (t.id === task.id ? task : t));
  render();
}

export function updateTask(id, { flow, ...fields }) {
  const task = { ...state.tasks.find((t) => t.id === id), ...fields, updatedAt: now() };
  return replaceTask(flow ? setFlow(task, flow) : task);
}

// ○ の完了はフローのないタスクだけ。フローがあるタスクはステップで進める
export function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (flowOf(task).length) return Promise.resolve();
  return replaceTask(task.completedAt ? reopenTask(task) : completeTask(task));
}

export const toggleTaskStep = (id, stepId) => replaceTask(toggleStep(state.tasks.find((t) => t.id === id), stepId));

export async function removeTask(id) {
  await db.deleteTask(id);
  state.tasks = state.tasks.filter((t) => t.id !== id);
  render();
}

export async function setSettings(fields) {
  state.settings = { ...state.settings, ...fields };
  await db.putSettings(state.settings);
  render();
}

export async function restore(incoming, mode) {
  const data = mergeData({ apps: state.apps, tasks: state.tasks, settings: state.settings }, incoming, mode);
  await db.replaceAll(data);
  state.apps = data.apps;
  state.tasks = data.tasks;
  state.settings = data.settings;
  state.ui.detailId = null;
  state.ui.filter.appId = 'all';
  render();
}

// 午前4時をまたいだら日付を変えて描き直す
export function checkDay() {
  const today = logicalDate();
  if (today !== state.today) {
    state.today = today;
    render();
  }
}
