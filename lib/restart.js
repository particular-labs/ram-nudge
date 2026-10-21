// Chrome blocks every extension route to chrome://restart (#5506, #5510): the user pastes it.
export const RESTART_URL = 'chrome://restart';

export const pasteKeyLabel = platform => (/mac/i.test(platform) ? '⌘V' : 'Ctrl+V');
