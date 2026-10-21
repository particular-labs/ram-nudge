import { DEFAULTS, normalize } from './threshold.js';

export const getSettings = async () => normalize(await chrome.storage.local.get(Object.keys(DEFAULTS)));
export const saveSettings = raw => chrome.storage.local.set(normalize(raw));
