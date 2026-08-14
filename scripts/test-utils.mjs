import { World } from "../site/js/world.js";

/** @param {import('../site/js/world.js').World} world @param {number} n */
export function runTicks(world, n) {
  for (let i = 0; i < n; i += 1) {
    world.tick();
  }
}

/**
 * @param {object} preset
 * @param {number} seed
 * @param {number} seconds
 */
export function runSimSeconds(preset, seed, seconds) {
  const world = new World(preset, seed);
  const ticks = Math.floor(seconds / world.dt);
  runTicks(world, ticks);
  return world;
}

/** @param {() => T} fn @returns {{ result: T, wallMs: number }} */
export function timed(fn) {
  const t0 = performance.now();
  const result = fn();
  return { result, wallMs: Math.round(performance.now() - t0) };
}
