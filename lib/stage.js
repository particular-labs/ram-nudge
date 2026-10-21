// Pure mood stages of the pebble (1 calm ... 5 melting) from free memory %, with hysteresis.
// T is the user's "low below" threshold. The nudge ("high") is stage >= 4, exactly the old rule:
// it starts below T and ends above T + 5.
export const HIGH_STAGE = 4;
export const isHigh = stage => stage >= HIGH_STAGE;

export const rawStage = (pct, T) => (pct >= T + 20 ? 1 : pct >= T + 10 ? 2 : pct >= T ? 3 : pct >= T / 2 ? 4 : 5);

// A better stage needs free memory above the stage's upper bound plus a margin (3 points; 4 -> 3 keeps T + 5).
const LEAVE_ABOVE = { 2: T => T + 23, 3: T => T + 13, 4: T => T + 5, 5: T => T / 2 + 3 };

// Worse is shown at once; better one stage at a time, only past its margin, so the face doesn't flicker.
export function nextStage(prev, pct, T) {
  if (!Number.isFinite(pct)) return prev; // an unreadable sample is not a reading
  const raw = rawStage(pct, T);
  if (raw >= prev) return raw;
  let stage = prev;
  while (stage > 1 && pct > LEAVE_ABOVE[stage](T)) stage--;
  return stage;
}

// The pebble sighs now and then while stressed, on the existing alarm tick (no timer of its own).
const SIGH_EVERY = { 3: 10, 4: 6, 5: 4 };
export const sighDue = (stage, ticks) => ticks > 0 && ticks % (SIGH_EVERY[stage] || Infinity) === 0;

// Popup heading for a stage; 0 means memory could not be read. Also the toolbar tooltip.
export const headingKey = stage => (stage === 0 ? 'popupError' : stage <= 2 ? 'popupOk' : stage === 3 ? 'popupFilling' : 'popupHigh');

export const frame = (stage, variant = '') => `stage-${stage}${variant}`; // variant: '' | '-squish' | '-stretch'
