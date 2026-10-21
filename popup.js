import { applyI18n, t } from './lib/i18n.js';

applyI18n();
const $ = id => document.getElementById(id);

// Wire the controls first: they must work even if the memory sample fails.
// Chrome blocks extensions from opening chrome://restart (spike #5506), so the user pastes it.
$('restart').onclick = async () => {
  const copied = await navigator.clipboard.writeText('chrome://restart').then(() => true, () => false);
  $('guide').hidden = false;
  $('guide').textContent = t(copied ? 'restartGuide' : 'restartGuideManual');
};
$('setup').onclick = () => chrome.tabs.create({ url: 'chrome://settings/onStartup' });
$('options').onclick = () => chrome.runtime.openOptionsPage();

const [res, tabs] = await Promise.all([
  chrome.runtime.sendMessage('check').catch(() => null),
  chrome.tabs.query({}),
]);
document.body.classList.toggle('high', !!res?.high);
$('state').textContent = t(!res ? 'popupError' : res.high ? 'popupHigh' : 'popupOk');
$('detail').textContent = res ? t('popupDetail', [String(Math.round(res.pct)), String(tabs.length)]) : '';
