// The pebble companion in the popup. Cosmetic only: no messages, no storage, no side effects.
// popup.js sets #pebble's data-stage (0 = unknown, 1 calm … 5 melting) and calls react('relief')
// after a restart or "Free memory now". Motion lives in styles.css and honours prefers-reduced-motion.
const el = document.getElementById('pebble');
const LENGTH_MS = { poke: 450, relief: 1400 };
let timer;
export function react(mood) {
  el.dataset.mood = mood;
  clearTimeout(timer);
  timer = setTimeout(() => delete el.dataset.mood, LENGTH_MS[mood]);
}
el.addEventListener('click', () => react('poke'));
