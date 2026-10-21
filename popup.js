import { applyI18n, t } from './lib/i18n.js';
import { RESTART_URL, pasteKeyLabel } from './lib/restart.js';

applyI18n();
const $ = id => document.getElementById(id);

// Wire the controls first: they must work even if the memory sample fails.
// The one place that starts a restart, so another way of restarting can replace it later.
// Chrome blocks extensions from opening chrome://restart (#5506), so: copy it, open a new tab (Chrome
// focuses its address bar) and let the hint under the button tell the user to paste + Enter.
async function startRestart() {
  const copied = await navigator.clipboard.writeText(RESTART_URL).then(() => true, () => false);
  if (copied) return chrome.tabs.create({});
  $('guide').textContent = t('restartGuideManual'); // no new tab: the user would lose this text
}
$('guide').textContent = t('restartHint', [pasteKeyLabel(navigator.platform)]);
$('restart').onclick = startRestart;
$('setup').onclick = () => chrome.tabs.create({ url: 'chrome://settings/onStartup' });
$('options').onclick = () => chrome.runtime.openOptionsPage();

const [res, tabs] = await Promise.all([
  chrome.runtime.sendMessage('check').catch(() => null),
  chrome.tabs.query({}),
]);
document.body.classList.toggle('high', !!res?.high);
$('state').textContent = t(!res ? 'popupError' : res.high ? 'popupHigh' : 'popupOk');
$('detail').textContent = res ? t('popupDetail', [String(Math.round(res.pct)), String(tabs.length)]) : '';
