import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawStage, nextStage, isHigh, sighDue, headingKey, frame } from '../lib/stage.js';

const T = 15; // bounds: 1 >= 35, 2 >= 25, 3 >= 15, 4 >= 7.5, 5 below

test('every stage boundary (strict at the bound, T = 15)', () => {
  const cases = [[100, 1], [35, 1], [34.9, 2], [25, 2], [24.9, 3], [15, 3], [14.9, 4], [7.5, 4], [7.4, 5], [0, 5]];
  for (const [pct, stage] of cases) assert.equal(rawStage(pct, T), stage, `${pct}%`);
});

test('bounds move with the threshold (T = 30)', () => {
  assert.deepEqual([50, 40, 30, 15, 14.9].map(p => rawStage(p, 30)), [1, 2, 3, 4, 5]);
});

test('worse is shown immediately, including jumps over stages', () => {
  assert.equal(nextStage(1, 24.9, T), 3);
  assert.equal(nextStage(2, 14.9, T), 4);
  assert.equal(nextStage(3, 2, T), 5);
  assert.equal(nextStage(4, 7.4, T), 5);
});

test('better only past the leaving margin, one stage at a time (3 points; 4 -> 3 at T + 5)', () => {
  assert.equal(nextStage(5, 10.5, T), 5); // 7.5 + 3 = 10.5 is not above
  assert.equal(nextStage(5, 10.6, T), 4);
  assert.equal(nextStage(4, 20, T), 4);   // T + 5 = 20 is not above
  assert.equal(nextStage(4, 20.1, T), 3);
  assert.equal(nextStage(3, 28, T), 3);   // T + 13
  assert.equal(nextStage(3, 28.1, T), 2);
  assert.equal(nextStage(2, 38, T), 2);   // T + 23
  assert.equal(nextStage(2, 38.1, T), 1);
});

test('a big recovery can skip stages but never leaves high before T + 5', () => {
  assert.equal(nextStage(5, 60, T), 1);
  assert.equal(nextStage(4, 60, T), 1);
  assert.equal(nextStage(5, 19, T), 4); // above 10.5 but not above 20: still high
  assert.equal(nextStage(5, 21, T), 3);
});

test('high (stage >= 4) is exactly the old rule: starts below T, ends above T + 5', () => {
  const oldHigh = (was, pct) => (was ? pct <= T + 5 : pct < T);
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let run = 0; run < 200; run++) {
    let stage = 1, was = false;
    for (let i = 0; i < 60; i++) {
      const pct = rnd() * 60;
      stage = nextStage(stage, pct, T);
      was = oldHigh(was, pct);
      assert.equal(isHigh(stage), was, `run ${run} step ${i} pct ${pct}`);
    }
  }
});

test('sigh cadence: stages 3/4/5 every 10/6/4 ticks, never on 1-2 or tick 0', () => {
  assert.equal(sighDue(3, 10), true);  assert.equal(sighDue(3, 9), false);
  assert.equal(sighDue(4, 6), true);   assert.equal(sighDue(4, 12), true);  assert.equal(sighDue(4, 5), false);
  assert.equal(sighDue(5, 4), true);   assert.equal(sighDue(5, 3), false);
  assert.equal(sighDue(1, 10), false); assert.equal(sighDue(2, 12), false); assert.equal(sighDue(4, 0), false);
});

test('tooltip/heading key per stage and frame names', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(headingKey), ['popupError', 'popupOk', 'popupOk', 'popupFilling', 'popupHigh', 'popupHigh']);
  assert.equal(frame(3), 'stage-3');
  assert.equal(frame(4, '-squish'), 'stage-4-squish');
});

test('an unreadable sample (NaN, undefined) keeps the current stage', () => {
  for (const prev of [1, 3, 4, 5]) { assert.equal(nextStage(prev, NaN, T), prev); assert.equal(nextStage(prev, undefined, T), prev); }
});
