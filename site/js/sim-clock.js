/** Allowed browser time scales (headless always uses 1). */
export const TIME_SCALES = [1, 5, 20];

/**
 * @param {number} value
 * @returns {1 | 5 | 20}
 */
export function normalizeTimeScale(value) {
  if (value === 5 || value === 20) return value;
  return 1;
}

/**
 * @param {URLSearchParams} params
 */
export function parseTimeScaleFromUrl(params) {
  const raw = params.get("timeScale");
  if (raw == null || raw === "") return 1;
  const parsed = Number.parseInt(raw, 10);
  return normalizeTimeScale(parsed);
}

/**
 * Browser sim clock: decouples logical ticks from render frames.
 * Headless / smoke ignore URL timeScale and stay at ×1.
 * @param {{ headless?: boolean, timeScale?: number }} [options]
 */
export function createSimClock(options = {}) {
  const headless = options.headless ?? false;

  const clock = {
    running: true,
    paused: false,
    timeScale: headless ? 1 : normalizeTimeScale(options.timeScale ?? 1),
    headless,

    /** @param {1 | 5 | 20} scale */
    setTimeScale(scale) {
      if (headless) return;
      clock.timeScale = normalizeTimeScale(scale);
    },

    togglePause() {
      clock.paused = !clock.paused;
      return clock.paused;
    },

    resume() {
      clock.paused = false;
      clock.running = true;
    },

    /**
     * Advance up to `timeScale` logical ticks for this render frame.
     * @param {import('./world.js').World} world
     * @param {number} [budgetCap] optional per-frame cap for UI responsiveness
     * @returns {number} ticks executed
     */
    stepFrame(world, budgetCap) {
      if (clock.paused || !clock.running) return 0;

      const budget = budgetCap != null
        ? Math.min(clock.timeScale, budgetCap)
        : clock.timeScale;

      for (let i = 0; i < budget; i += 1) {
        world.tick();
      }
      return budget;
    },
  };

  return clock;
}
