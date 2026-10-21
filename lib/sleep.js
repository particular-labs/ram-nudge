// Which tabs "Free memory now" puts to sleep (chrome.tabs.discard). It keeps the tab in front in each
// window (active), tabs playing sound, pinned tabs (people pin mail and music they want live), tabs the
// user excluded from Chrome's own memory saver (autoDiscardable false) and tabs already asleep.
export const tabsToSleep = tabs =>
  tabs.filter(t => !t.active && !t.audible && !t.pinned && !t.discarded && t.autoDiscardable !== false).map(t => t.id);
