// Pure core: no chrome.* here, so node can test it.
export const DEFAULTS = { highBelowPct: 15, snoozeMinutes: 60 };
export const HYSTERESIS_PCT = 5; // leaves "high" only above highBelowPct + this
export const FRESH_STATE = { high: false, notifyAfter: 0 }; // notifyAfter: ms epoch, null = already nudged

export const availablePct = ({ capacity, availableCapacity }) =>
  capacity > 0 ? (availableCapacity / capacity) * 100 : 100;

export const nextHigh = (wasHigh, pct, { highBelowPct }) =>
  wasHigh ? pct <= highBelowPct + HYSTERESIS_PCT : pct < highBelowPct;

// One nudge per high episode; snoozing re-arms it for later.
export function step(state, pct, now, cfg) {
  const high = nextHigh(state.high, pct, cfg);
  if (!high) return { state: FRESH_STATE, notify: false };
  const due = state.notifyAfter !== null && now >= state.notifyAfter;
  return { state: { high, notifyAfter: due ? null : state.notifyAfter }, notify: due };
}

export const snooze = (state, now, { snoozeMinutes }) => ({
  ...state,
  notifyAfter: now + snoozeMinutes * 60_000,
});

const clamp = (v, lo, hi, fallback) =>
  Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : fallback;

export const normalize = (raw = {}) => ({
  highBelowPct: clamp(raw.highBelowPct, 5, 90, DEFAULTS.highBelowPct),
  snoozeMinutes: clamp(raw.snoozeMinutes, 5, 1440, DEFAULTS.snoozeMinutes),
});
