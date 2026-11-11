// 画面に依存しない計算（Node のテストからも読み込む）

export const APP_NAME = 'devepatch';
export const SCHEMA_VERSION = 1;
export const DEFAULT_SETTINGS = { language: 'auto', theme: 'auto' };

const pad = (n) => String(n).padStart(2, '0');

// 1日は午前4時で変わる。時刻から4時間引いた日付（端末のタイムゾーン）を、その時刻の日付とする
export function logicalDate(at = new Date()) {
  const d = new Date(at instanceof Date ? at.getTime() : at);
  d.setHours(d.getHours() - 4);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export const byOrder = (a, b) => a.order - b.order;
const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
const byCompletedDesc = (a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0);

export function sortApps(apps) {
  return [...apps].sort(byOrder);
}

export function nextOrder(apps) {
  return apps.length ? Math.max(...apps.map((a) => a.order)) + 1 : 0;
}

// 未完了の一覧に出すタスク：未完了のものと、今日完了したもの（灰色で残す）。追加した順
export function openTasks(tasks, today) {
  return tasks.filter((t) => !t.completedAt || t.completedDate === today).sort(byCreated);
}

// 完了したタスク。完了の新しい順。excludeToday なら今日完了したもの（未完了の一覧に灰色で出るもの）を除く
export function doneTasks(tasks, today, excludeToday = false) {
  return tasks
    .filter((t) => t.completedAt && !(excludeToday && t.completedDate === today))
    .sort(byCompletedDesc);
}

// タスク画面の一覧。ライブラリの並びでアプリごとにまとめ、タスクのないアプリは出さない
export function groupTasks(apps, tasks, { appId = 'all', open = true, done = false, today }) {
  const groups = [];
  for (const app of sortApps(apps)) {
    if (appId !== 'all' && app.id !== appId) continue;
    const mine = tasks.filter((t) => t.appId === app.id);
    const openList = open ? openTasks(mine, today) : [];
    const doneList = done ? doneTasks(mine, today, open) : [];
    if (openList.length || doneList.length) groups.push({ app, open: openList, done: doneList });
  }
  return groups;
}

export function completeTask(task, at = new Date()) {
  return { ...task, completedAt: at.toISOString(), completedDate: logicalDate(at), updatedAt: at.toISOString() };
}

export function reopenTask(task, at = new Date()) {
  return { ...task, completedAt: null, completedDate: null, updatedAt: at.toISOString() };
}

// ダークならダーク用、なければライト用。ライトならその逆。どちらもなければ null（頭文字を出す）
export function appIcon(app, dark) {
  return (dark ? app.iconDark || app.iconLight : app.iconLight || app.iconDark) || null;
}

export function initial(name) {
  const first = [...String(name).trim()][0] || '?';
  return first.toUpperCase();
}

// 「example.com」のように入力されたら https:// を付けて開く
export function hrefOf(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

// 並べ替えの結果（id の並び）から order を 0, 1, 2… に振り直す
export function reorder(apps, ids) {
  const at = new Date().toISOString();
  return ids.map((id, i) => {
    const app = apps.find((a) => a.id === id);
    return app.order === i ? app : { ...app, order: i, updatedAt: at };
  });
}

// ---- バックアップ ----

export function backupFileName(at = new Date()) {
  return `${APP_NAME}-backup-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}.json`;
}

export function buildBackup({ apps, tasks, settings }, at = new Date()) {
  return { app: APP_NAME, schemaVersion: SCHEMA_VERSION, exportedAt: at.toISOString(), data: { apps, tasks, settings } };
}

export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // 'invalid' | 'otherApp' | 'newer'
  }
}

// 読み込んだ文字列を確かめ、今の形のデータにする
export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('invalid');
  }
  if (!json || typeof json !== 'object' || !json.data) throw new BackupError('invalid');
  if (json.app !== APP_NAME) throw new BackupError('otherApp');
  if (typeof json.schemaVersion !== 'number' || json.schemaVersion > SCHEMA_VERSION) throw new BackupError('newer');
  const { apps, tasks, settings } = json.data;
  if (!Array.isArray(apps) || !Array.isArray(tasks)) throw new BackupError('invalid');
  if (apps.some((a) => !a || !a.id || typeof a.name !== 'string')) throw new BackupError('invalid');
  if (tasks.some((t) => !t || !t.id || !t.appId || typeof t.title !== 'string')) throw new BackupError('invalid');
  return {
    apps: apps.map((a, i) => ({
      iconLight: null, iconDark: null, description: '', purpose: '', url: '',
      createdAt: json.exportedAt, updatedAt: json.exportedAt, ...a,
      order: typeof a.order === 'number' ? a.order : i,
    })),
    tasks: tasks.map((t) => ({
      description: '', completedAt: null, completedDate: null,
      createdAt: json.exportedAt, updatedAt: json.exportedAt, ...t,
    })),
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
  };
}

// 上書き：ファイルの内容だけにする。統合：同じ id はファイルで置き換え、ないものは足す
export function mergeData(current, incoming, mode) {
  let result;
  if (mode === 'overwrite') {
    result = { apps: incoming.apps, tasks: incoming.tasks, settings: incoming.settings };
  } else {
    const merge = (a, b) => {
      const map = new Map(a.map((x) => [x.id, x]));
      for (const x of b) map.set(x.id, x);
      return [...map.values()];
    };
    result = { apps: merge(current.apps, incoming.apps), tasks: merge(current.tasks, incoming.tasks), settings: incoming.settings };
  }
  // アプリのないタスクは残さない。order は並び順のまま振り直す
  const ids = new Set(result.apps.map((a) => a.id));
  result.tasks = result.tasks.filter((t) => ids.has(t.appId));
  result.apps = sortApps(result.apps).map((a, i) => ({ ...a, order: i }));
  return result;
}
