import { applyI18n, t } from './lib/i18n.js';
import { RESTART_URL, pasteKeyLabel } from './lib/restart.js';
import { headingKey, isHigh } from './lib/stage.js';
import { react } from './pebble.js';
import { tabsToSleep } from './lib/sleep.js';

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
// "Free memory now": discard (put to sleep) the tabs that are not in front; they reload when clicked.
async function sleepTabs() {
  $('sleep').disabled = true; // a second click while the first runs would overwrite its count
  try {
    const ids = tabsToSleep(await chrome.tabs.query({}));
    const slept = (await Promise.all(ids.map(id => chrome.tabs.discard(id).then(Boolean, () => false)))).filter(Boolean).length;
    $('sleepNote').dataset.result = ids.length ? 'done' : 'none';
    $('sleepNote').textContent = ids.length ? t('sleepDone', [String(slept)]) : t('sleepNone');
    if (slept > 0) { react('relief'); chrome.runtime.sendMessage('relief').catch(() => {}); }
  } catch {
    $('sleepNote').dataset.result = 'failed';
    $('sleepNote').textContent = t('sleepFailed');
  } finally {
    $('sleep').disabled = false;
  }
}
$('sleep').onclick = sleepTabs;
$('setup').onclick = () => chrome.tabs.create({ url: 'chrome://settings/onStartup' });
$('options').onclick = () => chrome.runtime.openOptionsPage();

const [res, tabs] = await Promise.all([
  chrome.runtime.sendMessage('check').catch(() => null),
  chrome.tabs.query({}),
]);
const stage = res ? res.stage : 0; // 0: memory could not be read
$('pebble').dataset.stage = String(stage);
document.body.classList.toggle('high', isHigh(stage));
$('state').textContent = t(headingKey(stage));
$('detail').textContent = res ? t('popupDetail', [String(Math.round(res.pct)), String(tabs.length)]) : '';
