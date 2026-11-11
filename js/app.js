// 起動・タブ・テーマと言語・更新の知らせ
import { resolveLang, setLang, t } from './i18n.js';
import { initKeyboard } from './keyboard.js';
import * as S from './state.js';
import { h, icon } from './ui.js';
import { libraryView } from './views/library.js';
import { settingsView } from './views/settings.js';
import { tasksView } from './views/tasks.js';

const TABS = [
  { id: 'library', icon: 'library', view: libraryView },
  { id: 'tasks', icon: 'tasks', view: tasksView },
  { id: 'settings', icon: 'settings', view: settingsView },
];
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyPrefs() {
  const { language, theme } = S.state.settings;
  setLang(resolveLang(language));
  const dark = theme === 'dark' || (theme === 'auto' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#000000' : '#f2f2f7';
}

function renderNav() {
  const { ui } = S.state;
  document.getElementById('nav').replaceChildren(...TABS.map((tab) =>
    h('button', {
      type: 'button', class: `tab${ui.tab === tab.id ? ' on' : ''}`, 'aria-current': ui.tab === tab.id ? 'page' : null,
      onClick: () => {
        // 今のタブをもう一度押したら、アプリ詳細から一覧に戻る
        if (tab.id === 'library') S.state.ui.detailId = null;
        ui.tab = tab.id;
        render();
        document.getElementById('scroller').scrollTop = 0;
      },
    }, icon(tab.icon, 26), h('span', {}, t(`tab.${tab.id}`)))));
}

function render() {
  applyPrefs();
  const tab = TABS.find((x) => x.id === S.state.ui.tab) || TABS[0];
  const scroller = document.getElementById('scroller');
  const top = scroller.scrollTop;
  document.getElementById('view').replaceChildren(...[tab.view()].flat(Infinity).filter(Boolean));
  scroller.scrollTop = top;
  renderNav();
}

// 新しい版の確認。公開中の version.js と、今動いている版を比べる
async function checkUpdate() {
  if (location.protocol === 'file:' || !navigator.onLine || document.querySelector('.update-bar')) return;
  try {
    const res = await fetch(`./version.js?t=${Date.now()}`, { cache: 'no-store' });
    const m = (await res.text()).match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (m && m[1] !== self.APP_VERSION) {
      document.body.append(h('button', { type: 'button', class: 'update-bar', onClick: () => location.reload() },
        icon('download', 18), t('update.available')));
    }
  } catch { /* オフラインなど */ }
}

async function start() {
  initKeyboard();
  await S.load();
  S.onChange(render);
  render();
  darkQuery.addEventListener('change', render);
  setInterval(S.checkDay, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    S.checkDay();
    checkUpdate();
  });
  checkUpdate();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
}

start();
