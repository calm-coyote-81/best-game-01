// A small seeded generator (mulberry32) so ?seed=N replays the same game and the same
// screenshots, while a fresh visit still feels random.
/** @returns a function returning a float in [0, 1) from the given 32-bit seed. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
