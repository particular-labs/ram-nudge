// Pure core: no chrome.* here, so node can test it.
import { nextStage, isHigh } from './stage.js';

export const DEFAULTS = { highBelowPct: 15, snoozeMinutes: 60 };
// stage: pebble mood 1-5 (high = stage >= 4); notifyAfter: ms epoch, null = already nudged;
// ticks: alarm ticks so far; shown: stage whose face is on the toolbar (null = unknown, show it).
export const FRESH_STATE = { stage: 1, notifyAfter: 0, ticks: 0, shown: null };

// Saved state may predate stages ({high, notifyAfter}); never lose an open nudge episode.
const validStage = s => Number.isInteger(s) && s >= 1 && s <= 5;
export const normalizeState = raw => ({
  stage: validStage(raw?.stage) ? raw.stage : raw?.high ? 4 : 1,
  notifyAfter: raw?.notifyAfter === null || Number.isFinite(raw?.notifyAfter) ? raw.notifyAfter : 0,
  ticks: Number.isInteger(raw?.ticks) && raw.ticks >= 0 ? raw.ticks : 0,
  shown: validStage(raw?.shown) ? raw.shown : null,
});

export const availablePct = ({ capacity, availableCapacity }) =>
  capacity > 0 ? (availableCapacity / capacity) * 100 : 100;

// One nudge per high episode; snoozing re-arms it for later.
export function step(state, pct, now, cfg) {
  const stage = nextStage(state.stage ?? 1, pct, cfg.highBelowPct);
  if (!isHigh(stage)) return { state: { ...state, stage, notifyAfter: 0 }, notify: false };
  const due = state.notifyAfter !== null && now >= state.notifyAfter;
  return { state: { ...state, stage, notifyAfter: due ? null : state.notifyAfter }, notify: due };
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
