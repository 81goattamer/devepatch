// 設定：iPhone の設定アプリのようなリスト
import { t } from '../i18n.js';
import * as S from '../state.js';
import { BackupError, backupFileName, buildBackup, parseBackup } from '../store.js';
import { actionSheet, confirmDialog, h, icon, toast } from '../ui.js';

export function settingsView() {
  const { settings } = S.state;
  const langLabel = { auto: t('settings.auto'), ja: '日本語', en: 'English' };
  const themeLabel = { auto: t('settings.auto'), light: t('settings.light'), dark: t('settings.dark') };

  const choose = (title, key, labels) => () =>
    actionSheet(Object.entries(labels).map(([value, label]) => ({
      label: settings[key] === value ? `✓ ${label}` : label,
      onSelect: () => S.setSettings({ [key]: value }),
    })), title);

  const row = (label, value, onClick, iconName) =>
    h('button', { type: 'button', class: 'row link-row', onClick },
      iconName && icon(iconName, 20),
      h('span', { class: 'row-label' }, label),
      value != null && h('span', { class: 'row-value' }, value),
      icon('chevron', 18));

  return [
    h('header', { class: 'large-title' }, h('h1', {}, t('tab.settings'))),
    h('div', { class: 'group-title' }, t('settings.general')),
    h('div', { class: 'group' },
      row(t('settings.language'), langLabel[settings.language], choose(t('settings.language'), 'language', langLabel)),
      row(t('settings.theme'), themeLabel[settings.theme], choose(t('settings.theme'), 'theme', themeLabel))),
    h('div', { class: 'group-title' }, t('settings.backup')),
    h('div', { class: 'group' },
      row(t('settings.export'), null, exportData, 'download'),
      row(t('settings.import'), null, importData, 'upload')),
    h('div', { class: 'group-note' }, t('settings.backupNote')),
    h('div', { class: 'group' },
      h('div', { class: 'row' }, h('span', { class: 'row-label' }, t('settings.version')), h('span', { class: 'row-value' }, self.APP_VERSION))),
  ];
}

function exportData() {
  const { apps, tasks, settings } = S.state;
  const json = JSON.stringify(buildBackup({ apps, tasks, settings }), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = h('a', { href: url, download: backupFileName() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast(t('export.done'));
}

function importData() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden-input' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.remove();
    if (!file) return;
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (e) {
      toast(t(e instanceof BackupError ? `import.${e.code}` : 'import.invalid'));
      return;
    }
    const apply = async (mode) => {
      await S.restore(data, mode);
      toast(t('import.done'));
    };
    actionSheet([
      { label: t('import.overwrite'), danger: true, onSelect: async () => {
        if (await confirmDialog(t('import.overwriteConfirm'), t('import.overwrite').split(/[（(]/)[0].trim(), true)) apply('overwrite');
      } },
      { label: t('import.merge'), onSelect: () => apply('merge') },
    ], t('import.modeTitle'));
  });
  document.body.append(input);
  input.click();
}
