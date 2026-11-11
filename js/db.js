// IndexedDB への保存。画面はメモリ上の state を使い、変えたものだけここで書き込む
const DB_NAME = 'devepatch';
const DB_VERSION = 1;
let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('apps')) db.createObjectStore('apps', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' }).createIndex('appId', 'appId');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const result = fn(tx);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const all = (store) =>
  run([store], 'readonly', (tx) => {
    const out = [];
    tx.objectStore(store).getAll().onsuccess = (e) => out.push(...e.target.result);
    return out;
  });

export async function loadAll() {
  const [apps, tasks] = await Promise.all([all('apps'), all('tasks')]);
  const settings = await run(['settings'], 'readonly', (tx) => {
    const box = {};
    tx.objectStore('settings').get('main').onsuccess = (e) => Object.assign(box, e.target.result || {});
    return box;
  });
  return { apps, tasks, settings };
}

export const putApps = (apps) => run(['apps'], 'readwrite', (tx) => apps.forEach((a) => tx.objectStore('apps').put(a)));
export const putTask = (task) => run(['tasks'], 'readwrite', (tx) => tx.objectStore('tasks').put(task));
export const deleteTask = (id) => run(['tasks'], 'readwrite', (tx) => tx.objectStore('tasks').delete(id));
export const putSettings = (s) => run(['settings'], 'readwrite', (tx) => tx.objectStore('settings').put(s, 'main'));

// アプリとそのタスクを1回の処理で消す
export const deleteApp = (appId, taskIds) =>
  run(['apps', 'tasks'], 'readwrite', (tx) => {
    taskIds.forEach((id) => tx.objectStore('tasks').delete(id));
    tx.objectStore('apps').delete(appId);
  });

// 復元：全部を入れ替える
export const replaceAll = ({ apps, tasks, settings }) =>
  run(['apps', 'tasks', 'settings'], 'readwrite', (tx) => {
    const a = tx.objectStore('apps');
    const t = tx.objectStore('tasks');
    a.clear();
    t.clear();
    apps.forEach((x) => a.put(x));
    tasks.forEach((x) => t.put(x));
    tx.objectStore('settings').put(settings, 'main');
  });
