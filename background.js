import { availablePct, step, snooze, normalizeState } from './lib/threshold.js';
import { sighDue, headingKey, frame, isHigh } from './lib/stage.js';
import { getSettings } from './lib/settings.js';
import { t } from './lib/i18n.js';

const NOTE_ID = 'low-memory';
const loadState = async () => normalizeState((await chrome.storage.session.get('state')).state);
const saveState = state => chrome.storage.session.set({ state });

// Toolbar face. One frame per stage; setIcon only when the shown stage is not the current one, plus
// short one-shots (wince when worse, relief when better, a sigh now and then while stressed). They run
// inside the serialized work the worker already does, one after another: no timer-driven loop.
// state.shown remembers which face is really on the toolbar, so a failed update is retried next tick.
const iconPath = name => ({ 16: `stages/png/${name}-16.png`, 32: `stages/png/${name}-32.png` });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function play(frames) { // [[frame name, ms to hold]] -> true when every frame was set
  try {
    for (const [name, ms] of frames) {
      await chrome.action.setIcon({ path: iconPath(name) });
      if (ms) await sleep(ms);
    }
    return true;
  } catch {
    return false;
  }
}
const wince = stage => play([[frame(stage, '-squish'), 120], [frame(stage, '-stretch'), 120], [frame(stage), 0]]);
const relief = stage => play([['relief', 1500], [frame(stage), 0]]);

async function showStage(stage, prev) { // true when face and tooltip are both current
  const titled = await chrome.action.setTitle({ title: t(headingKey(stage)) }).then(() => true, () => false);
  const drawn = await (stage > prev ? wince(stage) : stage < prev && stage <= 2 ? relief(stage) : play([[frame(stage), 0]]));
  return titled && drawn;
}

async function run({ alarm = false } = {}) {
  const cfg = await getSettings();
  const pct = availablePct(await chrome.system.memory.getInfo());
  if (!Number.isFinite(pct)) throw new Error('unreadable memory sample');
  const prev = await loadState();
  const { state: stepped, notify } = step(prev, pct, Date.now(), cfg);
  const state = { ...stepped, ticks: prev.ticks + (alarm ? 1 : 0) };
  // Any update that did not fully succeed may have left a half-drawn face: forget it (null) and redraw next tick.
  if (state.stage !== prev.shown) {
    state.shown = (await showStage(state.stage, prev.shown ?? prev.stage)) ? state.stage : null;
  } else if (alarm && sighDue(state.stage, state.ticks)) {
    if (!(await wince(state.stage))) state.shown = null;
  }
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
  return { high: isHigh(state.stage), stage: state.stage, pct };
}

// Every state read-modify-write goes through this queue, so an alarm tick, a popup check and a
// snooze click can't read the same old state and overwrite each other.
let queue = Promise.resolve();
const serial = fn => (queue = queue.catch(() => {}).then(fn));
const check = () => serial(run);
const tick = (alarm = false) => serial(() => run({ alarm })).catch(() => {}); // background callers: a failed sample just waits for the next tick

// Alarms can vanish across browser restarts; every worker start re-creates a missing one.
chrome.alarms.get('poll').then(a => a || chrome.alarms.create('poll', { periodInMinutes: 0.5 }));
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'poll') tick(true); });
chrome.runtime.onStartup.addListener(tick);
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
  tick();
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === 'check') {
    check().then(reply, () => reply(null)); // always answer: the popup must not hang on a failed sample
    return true;
  }
  if (msg === 'relief') { // the popup just freed memory: a moment of relief on the toolbar face
    serial(async () => {
      const state = await loadState();
      if (!(await relief(state.stage))) await saveState({ ...state, shown: null }); // unknown face: redraw next run
    }).catch(() => {});
  }
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
