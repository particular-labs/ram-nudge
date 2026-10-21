import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availablePct, nextHigh, step, snooze, normalize, FRESH_STATE, DEFAULTS } from '../lib/threshold.js';

const cfg = DEFAULTS; // high below 15%, clears above 20%, snooze 60 min
const MIN = 60_000;

test('availablePct handles zero capacity', () => {
  assert.equal(availablePct({ capacity: 200, availableCapacity: 50 }), 25);
  assert.equal(availablePct({ capacity: 0, availableCapacity: 0 }), 100);
});

test('hysteresis: enters below 15, stays high through 20, clears above 20', () => {
  assert.equal(nextHigh(false, 15, cfg), false); // boundary is strict
  assert.equal(nextHigh(false, 14.9, cfg), true);
  assert.equal(nextHigh(true, 20, cfg), true);
  assert.equal(nextHigh(true, 20.1, cfg), false);
  assert.equal(nextHigh(false, 18, cfg), false); // in the band but was normal: stays normal
});

test('one nudge per episode, none while normal', () => {
  let r = step(FRESH_STATE, 50, 0, cfg);
  assert.equal(r.notify, false);
  r = step(r.state, 10, 1000, cfg);
  assert.equal(r.notify, true);
  r = step(r.state, 9, 2000, cfg);
  assert.equal(r.notify, false);
  r = step(r.state, 18, 3000, cfg); // inside hysteresis band: still same episode
  assert.equal(r.notify, false);
  r = step(r.state, 30, 4000, cfg); // episode ends
  r = step(r.state, 10, 5000, cfg); // new episode nudges again
  assert.equal(r.notify, true);
});

test('snooze defers the nudge and re-arms it after the window', () => {
  let r = step(FRESH_STATE, 10, 0, cfg);
  assert.equal(r.notify, true);
  const snoozed = snooze(r.state, 1000, cfg);
  r = step(snoozed, 10, 1000 + 59 * MIN, cfg);
  assert.equal(r.notify, false);
  r = step(r.state, 10, 1000 + 60 * MIN, cfg);
  assert.equal(r.notify, true);
  assert.equal(step(r.state, 10, 1000 + 61 * MIN, cfg).notify, false);
});

test('normalize clamps and falls back on bad input', () => {
  assert.deepEqual(normalize({}), DEFAULTS);
  assert.deepEqual(normalize({ highBelowPct: '', snoozeMinutes: 'abc' }), DEFAULTS);
  assert.deepEqual(normalize({ highBelowPct: 1, snoozeMinutes: 99999 }), { highBelowPct: 5, snoozeMinutes: 1440 });
  assert.deepEqual(normalize({ highBelowPct: '90', snoozeMinutes: 30.4 }), { highBelowPct: 90, snoozeMinutes: 30 });
});
