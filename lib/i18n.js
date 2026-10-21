export const t = (key, subs) => chrome.i18n.getMessage(key, subs);

export const applyI18n = () =>
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
