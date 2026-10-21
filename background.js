import { availablePct, step, snooze, FRESH_STATE } from './lib/threshold.js';
import { getSettings } from './lib/settings.js';
import { t } from './lib/i18n.js';

const NOTE_ID = 'low-memory';
const loadState = async () => (await chrome.storage.session.get('state')).state ?? FRESH_STATE;
const saveState = state => chrome.storage.session.set({ state });

async function run() {
  const cfg = await getSettings();
  const pct = availablePct(await chrome.system.memory.getInfo());
  const { state, notify } = step(await loadState(), pct, Date.now(), cfg);
  await chrome.action.setBadgeText({ text: state.high ? '!' : '' });
  if (state.high) await chrome.action.setBadgeBackgroundColor({ color: '#b3261e' });
  let next = state;
  if (notify) {
    try {
      await chrome.notifications.create(NOTE_ID, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: t('noteTitle'),
        message: t('noteMessage'),
        buttons: [{ title: t('restartBtn') }, { title: t('snoozeBtn') }],
      });
    } catch {
      next = { ...state, notifyAfter: 0 }; // creation failed: stay due so the next tick retries
    }
  }
  await saveState(next);
  return { high: state.high, pct };
}

// Every state read-modify-write goes through this queue, so an alarm tick, a popup check and a
// snooze click can't read the same old state and overwrite each other.
let queue = Promise.resolve();
const serial = fn => (queue = queue.catch(() => {}).then(fn));
const check = () => serial(run);
const tick = () => check().catch(() => {}); // background callers: a failed sample just waits for the next tick

// Alarms can vanish across browser restarts; every worker start re-creates a missing one.
chrome.alarms.get('poll').then(a => a || chrome.alarms.create('poll', { periodInMinutes: 0.5 }));
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'poll') tick(); });
chrome.runtime.onStartup.addListener(tick);
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
  tick();
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg !== 'check') return;
  check().then(reply, () => reply(null)); // always answer: the popup must not hang on a failed sample
  return true;
});

chrome.notifications.onButtonClicked.addListener(async (id, button) => {
  if (id !== NOTE_ID) return;
  chrome.notifications.clear(id);
  if (button === 1) {
    await serial(async () => saveState(snooze(await loadState(), Date.now(), await getSettings())));
  } else {
    // The popup holds the restart button; fall back to a tab if Chrome refuses to open it.
    Promise.resolve() // openPopup is missing before Chrome 127 and throws synchronously
      .then(() => chrome.action.openPopup())
      .catch(() => chrome.tabs.create({ url: 'popup.html' }));
  }
});
