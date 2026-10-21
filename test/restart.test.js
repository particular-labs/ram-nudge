import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasteKeyLabel, RESTART_URL } from '../lib/restart.js';

test('paste shortcut label follows the platform', () => {
  assert.equal(pasteKeyLabel('MacIntel'), '⌘V');
  assert.equal(pasteKeyLabel('Win32'), 'Ctrl+V');
  assert.equal(pasteKeyLabel('Linux x86_64'), 'Ctrl+V');
  assert.equal(pasteKeyLabel(''), 'Ctrl+V');
});

test('restart url is the one Chrome handles itself', () => assert.equal(RESTART_URL, 'chrome://restart'));
