import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BackupError, appIcon, buildBackup, flowFromNames, flowProgress, setFlow, toggleStep, completeTask, doneTasks, groupTasks, hrefOf, initial, logicalDate,
  mergeData, nextOrder, openTasks, parseBackup, reopenTask, reorder,
} from '../js/store.js';

const at = (s) => new Date(s); // 端末のタイムゾーンでの時刻

test('日付は午前4時で変わる', () => {
  assert.equal(logicalDate(at('2026-11-12T03:59:00')), '2026-11-11');
  assert.equal(logicalDate(at('2026-11-12T04:00:00')), '2026-11-12');
  assert.equal(logicalDate(at('2026-01-01T02:00:00')), '2025-12-31');
});

test('完了すると完了日が付き、戻すと消える', () => {
  const t0 = { id: '1', appId: 'a', title: 'x', completedAt: null, completedDate: null };
  const done = completeTask(t0, at('2026-11-12T01:30:00'));
  assert.equal(done.completedDate, '2026-11-11');
  assert.ok(done.completedAt);
  const back = reopenTask(done);
  assert.equal(back.completedAt, null);
  assert.equal(back.completedDate, null);
});

const tasks = [
  { id: '1', appId: 'a', title: '未完了', createdAt: '2026-11-01', completedAt: null, completedDate: null },
  { id: '2', appId: 'a', title: '今日完了', createdAt: '2026-11-02', completedAt: '2026-11-11T10:00:00Z', completedDate: '2026-11-11' },
  { id: '3', appId: 'a', title: '昨日完了', createdAt: '2026-10-30', completedAt: '2026-11-10T10:00:00Z', completedDate: '2026-11-10' },
  { id: '4', appId: 'b', title: 'B', createdAt: '2026-10-01', completedAt: null, completedDate: null },
];
const today = '2026-11-11';

test('未完了の一覧には今日完了したものも残り、昨日以前に完了したものは出ない', () => {
  assert.deepEqual(openTasks(tasks, today).map((t) => t.id), ['4', '1', '2']);
});

test('完了済みは新しい順。未完了と一緒に出すときは今日の分を重ねない', () => {
  assert.deepEqual(doneTasks(tasks, today).map((t) => t.id), ['2', '3']);
  assert.deepEqual(doneTasks(tasks, today, true).map((t) => t.id), ['3']);
});

test('タスク画面はライブラリの並びでアプリごとにまとめ、空のアプリは出さない', () => {
  const apps = [{ id: 'b', order: 0 }, { id: 'a', order: 1 }, { id: 'c', order: 2 }];
  const g = groupTasks(apps, tasks, { appId: 'all', open: true, done: false, today });
  assert.deepEqual(g.map((x) => x.app.id), ['b', 'a']);
  const onlyA = groupTasks(apps, tasks, { appId: 'a', open: false, done: true, today });
  assert.deepEqual(onlyA.map((x) => x.done.map((t) => t.id)), [['2', '3']]);
});

test('アイコンは片方だけなら両方に使い、なければ頭文字', () => {
  assert.equal(appIcon({ iconLight: 'L', iconDark: null }, true), 'L');
  assert.equal(appIcon({ iconLight: null, iconDark: 'D' }, false), 'D');
  assert.equal(appIcon({ iconLight: 'L', iconDark: 'D' }, true), 'D');
  assert.equal(appIcon({ iconLight: null, iconDark: null }, true), null);
  assert.equal(initial('  stacklog'), 'S');
  assert.equal(initial('日記'), '日');
});

test('URL に https:// を補う', () => {
  assert.equal(hrefOf('example.com'), 'https://example.com');
  assert.equal(hrefOf('http://a.b'), 'http://a.b');
  assert.equal(hrefOf(''), '');
});

test('並び順', () => {
  const apps = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }];
  assert.equal(nextOrder(apps), 3);
  assert.equal(nextOrder([]), 0);
  assert.deepEqual(reorder(apps, ['c', 'a', 'b']).map((a) => [a.id, a.order]), [['c', 0], ['a', 1], ['b', 2]]);
});

test('バックアップを書き出して読み込める', () => {
  const data = { apps: [{ id: 'a', name: 'A', order: 0 }], tasks: [{ id: '1', appId: 'a', title: 'x' }], settings: { language: 'en', theme: 'dark' } };
  const parsed = parseBackup(JSON.stringify(buildBackup(data)));
  assert.equal(parsed.apps[0].name, 'A');
  assert.equal(parsed.apps[0].iconLight, null);
  assert.equal(parsed.tasks[0].completedAt, null);
  assert.equal(parsed.settings.theme, 'dark');
});

test('読み込めないファイルは理由を返す', () => {
  const code = (text) => {
    try {
      parseBackup(text);
    } catch (e) {
      assert.ok(e instanceof BackupError);
      return e.code;
    }
    return 'ok';
  };
  assert.equal(code('not json'), 'invalid');
  assert.equal(code(JSON.stringify({ app: 'Stacklog', schemaVersion: 1, data: {} })), 'otherApp');
  assert.equal(code(JSON.stringify({ app: 'devepatch', schemaVersion: 99, data: { apps: [], tasks: [] } })), 'newer');
  assert.equal(code(JSON.stringify({ app: 'devepatch', schemaVersion: 1, data: { apps: 'x', tasks: [] } })), 'invalid');
});

test('上書きと統合', () => {
  const current = {
    apps: [{ id: 'a', name: 'A', order: 0 }, { id: 'b', name: 'B', order: 1 }],
    tasks: [{ id: '1', appId: 'a', title: '端末' }, { id: '2', appId: 'b', title: 'B' }],
    settings: { language: 'ja', theme: 'auto' },
  };
  const incoming = {
    apps: [{ id: 'a', name: 'A2', order: 0 }, { id: 'c', name: 'C', order: 5 }],
    tasks: [{ id: '1', appId: 'a', title: 'ファイル' }, { id: '9', appId: 'zz', title: 'アプリなし' }],
    settings: { language: 'en', theme: 'dark' },
  };
  const over = mergeData(current, incoming, 'overwrite');
  assert.deepEqual(over.apps.map((a) => a.id), ['a', 'c']);
  assert.deepEqual(over.tasks.map((t) => t.id), ['1']);
  const merged = mergeData(current, incoming, 'merge');
  assert.deepEqual(merged.apps.map((a) => [a.id, a.name, a.order]), [['a', 'A2', 0], ['b', 'B', 1], ['c', 'C', 2]]);
  assert.deepEqual(merged.tasks.map((t) => t.title).sort(), ['B', 'ファイル']);
  assert.equal(merged.settings.language, 'en');
});

test('標準フローの名前からステップを作る（空の名前は捨てる）', () => {
  const flow = flowFromNames(['コード作成', ' ', '反映確認']);
  assert.deepEqual(flow.map((st) => st.name), ['コード作成', '反映確認']);
  assert.ok(flow.every((st) => st.id && st.doneAt === null));
  assert.deepEqual(flowFromNames(undefined), []);
});

test('ステップを全部済ませると完了、1つ戻すと未完了に戻る', () => {
  const base = { id: 't', appId: 'a', title: 'バックアップ機能の追加', completedAt: null, completedDate: null, flow: flowFromNames(['コード作成', '反映確認']) };
  const [s1, s2] = base.flow;
  let task = toggleStep(base, s1.id, at('2026-11-14T10:00:00'));
  assert.deepEqual(flowProgress(task), { done: 1, total: 2, ratio: 0.5 });
  assert.equal(task.completedAt, null);
  task = toggleStep(task, s2.id, at('2026-11-15T02:00:00'));
  assert.equal(flowProgress(task).ratio, 1);
  assert.equal(task.completedDate, '2026-11-14'); // 午前4時より前なので前の日
  task = toggleStep(task, s1.id, at('2026-11-15T09:00:00'));
  assert.equal(task.completedAt, null);
  assert.equal(task.completedDate, null);
});

test('フローを編集して未済みのステップが増えたら未完了に戻る', () => {
  const flow = flowFromNames(['A']).map((st) => ({ ...st, doneAt: '2026-11-14T10:00:00Z' }));
  const done = { id: 't', flow, completedAt: '2026-11-14T10:00:00Z', completedDate: '2026-11-14' };
  const more = setFlow(done, [...flow, ...flowFromNames(['B'])]);
  assert.equal(more.completedAt, null);
  const fewer = setFlow(more, [{ ...more.flow[0] }, { ...more.flow[1], name: '  ' }], at('2026-11-14T12:00:00'));
  assert.equal(fewer.flow.length, 1);
  assert.equal(fewer.completedDate, '2026-11-14');
});

test('版1のバックアップはフローなしとして読み込める', () => {
  const v1 = { app: 'devepatch', schemaVersion: 1, exportedAt: '2026-11-11T00:00:00Z', data: { apps: [{ id: 'a', name: 'A', order: 0 }], tasks: [{ id: '1', appId: 'a', title: 'x' }], settings: {} } };
  const parsed = parseBackup(JSON.stringify(v1));
  assert.deepEqual(parsed.apps[0].defaultFlow, []);
  assert.deepEqual(parsed.tasks[0].flow, []);
});
