import { applyI18n } from './lib/i18n.js';

applyI18n();
document.getElementById('open').onclick = () => chrome.tabs.create({ url: 'chrome://settings/onStartup' });
