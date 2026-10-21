import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabsToSleep } from '../lib/sleep.js';

const tab = (id, over = {}) => ({ id, active: false, audible: false, pinned: false, discarded: false, autoDiscardable: true, ...over });

test('sleeps plain background tabs in every window and keeps each window\'s active tab', () => {
  const tabs = [tab(1, { active: true }), tab(2), tab(3), tab(4, { active: true }), tab(5)]; // two windows
  assert.deepEqual(tabsToSleep(tabs), [2, 3, 5]);
});

test('keeps audible, pinned, already asleep and memory-saver-excluded tabs', () => {
  const tabs = [tab(1, { audible: true }), tab(2, { pinned: true }), tab(3, { discarded: true }), tab(4, { autoDiscardable: false }), tab(5)];
  assert.deepEqual(tabsToSleep(tabs), [5]);
});

test('treats a missing autoDiscardable as sleepable and an empty list as nothing to do', () => {
  assert.deepEqual(tabsToSleep([{ id: 7 }]), [7]);
  assert.deepEqual(tabsToSleep([]), []);
});
