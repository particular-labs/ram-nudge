import { applyI18n, t } from './lib/i18n.js';
import { getSettings, saveSettings } from './lib/settings.js';
import { HYSTERESIS_PCT } from './lib/threshold.js';

applyI18n();
const $ = id => document.getElementById(id);
const fields = ['highBelowPct', 'snoozeMinutes'];

function show(s) {
  fields.forEach(f => { $(f).value = s[f]; });
  $('clearHint').textContent = t('optClear', [String(s.highBelowPct + HYSTERESIS_PCT)]);
}

show(await getSettings());
document.querySelector('main').addEventListener('change', async () => {
  await saveSettings(Object.fromEntries(fields.map(f => [f, $(f).value])));
  show(await getSettings());
  $('saved').textContent = t('optSaved');
});
