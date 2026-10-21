import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal chrome.* stub so the real background.js runs in node.
const store = { local: { highBelowPct: 15, snoozeMinutes: 60 }, session: {} };
const calls = { icon: [], title: [], notify: [] };
let mem = { capacity: 100, availableCapacity: 50 };
let failIcon = false;
let alarmFn, messageFn;
const area = o => ({ get: async k => (typeof k === 'string' ? { [k]: o[k] } : { ...o }), set: async v => { Object.assign(o, v); } });
globalThis.chrome = {
  alarms: { get: async () => ({}), create: () => {}, onAlarm: { addListener: f => { alarmFn = f; } } },
  runtime: { onStartup: { addListener: () => {} }, onInstalled: { addListener: () => {} }, onMessage: { addListener: f => { messageFn = f; } } },
  notifications: { create: async (...a) => { calls.notify.push(a); }, clear: () => {}, onButtonClicked: { addListener: () => {} } },
  action: {
    setIcon: async o => { if (failIcon) throw new Error('icon'); calls.icon.push(o.path[16].replace('stages/png/', '').replace('-16.png', '')); },
    setTitle: async o => { calls.title.push(o.title); }, openPopup: async () => {},
  },
  storage: { local: area(store.local), session: area(store.session) },
  system: { memory: { getInfo: async () => mem } },
  i18n: { getMessage: k => k },
  tabs: { create: async () => {} },
};
globalThis.setTimeout = (fn, ms, ...a) => { queueMicrotask(() => fn(...a)); return 0; }; // holds are not worth waiting for in tests
await import('../background.js');

const setFree = pct => { mem = { capacity: 100, availableCapacity: pct }; };
const tick = async () => { await alarmFn({ name: 'poll' }); await new Promise(r => setImmediate(r)); };
const check = () => new Promise(res => { messageFn('check', null, res); });
const reset = () => { store.session.state = undefined; calls.icon.length = calls.title.length = calls.notify.length = 0; failIcon = false; };

test('first run draws and titles the face once, then stays quiet while the stage holds', async () => {
  reset(); setFree(50);
  await tick();
  assert.deepEqual(calls.icon, ['stage-1']);
  assert.deepEqual(calls.title, ['popupOk']);
  await tick(); await tick();
  assert.equal(calls.icon.length, 1);
  assert.equal(calls.title.length, 1);
});

test('worse: wince then stage face, title follows; one nudge for the episode', async () => {
  reset(); setFree(50); await tick(); calls.icon.length = 0;
  setFree(10); await tick();
  assert.deepEqual(calls.icon, ['stage-4-squish', 'stage-4-stretch', 'stage-4']);
  assert.equal(calls.title.at(-1), 'popupHigh');
  assert.equal(calls.notify.length, 1);
  await tick(); assert.equal(calls.notify.length, 1);
});

test('a failed setIcon is retried on the next tick', async () => {
  reset(); setFree(50); await tick(); calls.icon.length = 0;
  setFree(10); failIcon = true; await tick();
  assert.equal(calls.icon.length, 0);
  failIcon = false; await tick();
  assert.equal(calls.icon.at(-1), 'stage-4');
});

test('better to stage <= 2 plays relief; sighs only on alarm ticks at their cadence; popup checks do not count', async () => {
  reset(); setFree(50); await tick(); setFree(10); await tick(); calls.icon.length = 0;
  for (let i = 0; i < 5; i++) await check(); // not alarm ticks
  assert.equal(calls.icon.length, 0);
  await tick(); await tick(); await tick(); // alarm ticks 2..4 since the stage change tick (1): stage 4 sighs on tick 6
  assert.equal(calls.icon.length, 0);
  await tick(); await tick(); // ticks 5, 6
  assert.deepEqual(calls.icon, ['stage-4-squish', 'stage-4-stretch', 'stage-4']);
  calls.icon.length = 0; setFree(60); await tick();
  assert.deepEqual(calls.icon, ['relief', 'stage-1']);
});

test('an unreadable sample changes nothing and the popup gets null', async () => {
  reset(); setFree(50); await tick(); const before = JSON.stringify(store.session.state);
  mem = { capacity: 100 }; // availableCapacity missing
  assert.equal(await check(), null);
  assert.equal(JSON.stringify(store.session.state), before);
  assert.equal(calls.notify.length, 0);
});

test('an old-shaped saved state keeps its open nudge episode', async () => {
  reset(); store.session.state = { high: true, notifyAfter: null }; setFree(18); // 18% is inside the exit band (T+5 = 20)
  await tick();
  assert.equal(store.session.state.stage, 4);
  setFree(10); await tick();
  assert.equal(calls.notify.length, 0); // already nudged: no duplicate
  assert.equal(Number.isFinite(store.session.state.ticks), true);
});

test('a transition that fails half way is redrawn on the next tick (no stale squish frame)', async () => {
  reset(); setFree(50); await tick();
  const realSet = chrome.action.setIcon; let n = 0;
  chrome.action.setIcon = async o => { if (++n === 2) throw new Error('stretch'); return realSet(o); }; // squish ok, stretch fails
  setFree(10); await tick();
  chrome.action.setIcon = realSet; calls.icon.length = 0;
  setFree(60); await tick(); // recovers to stage 1: must draw it, not trust the old stage
  assert.equal(calls.icon.at(-1), 'stage-1');
});

test('a failed sigh is redrawn on the next tick', async () => {
  reset(); setFree(50); await tick(); setFree(10); await tick();
  for (let i = 0; i < 3; i++) await tick(); // ticks 3-5, no sigh yet
  const realSet = chrome.action.setIcon; let n = 0;
  chrome.action.setIcon = async o => { if (++n === 2) throw new Error('stretch'); return realSet(o); };
  await tick(); // tick 6 = stage-4 sigh, stretch fails
  chrome.action.setIcon = realSet; calls.icon.length = 0;
  await tick();
  assert.equal(calls.icon.at(-1), 'stage-4');
});

test('a garbage saved stage is repaired instead of breaking every check', async () => {
  reset(); store.session.state = { stage: 99, notifyAfter: null, ticks: 'x', shown: 7 }; setFree(50);
  const r = await check();
  assert.equal(r.stage, 1);
  assert.equal(store.session.state.ticks, 0);
});
