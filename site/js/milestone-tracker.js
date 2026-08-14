/**
 * Detect metric threshold crossings and emit milestone messages once per run.
 */

import {
  ALL_MILESTONE_CONDITIONS,
  isConditionMet,
} from "./milestone-conditions.js";

/**
 * @param {{ onMilestone: (msg: string) => void }} handlers
 */
export function createMilestoneTracker(handlers) {
  /** @type {Set<string>} */
  const achieved = new Set();

  function reset() {
    achieved.clear();
  }

  /**
   * @param {object} metricsHud from formatHud()
   * @param {object} preset
   */
  function check(metricsHud, preset) {
    for (const def of ALL_MILESTONE_CONDITIONS) {
      if (achieved.has(def.id)) continue;
      if (!isConditionMet(def, metricsHud, preset)) continue;
      achieved.add(def.id);
      handlers.onMilestone(`里程碑 · ${def.stage}：${def.label} 达到门槛`);
    }
  }

  function getAchieved() {
    return achieved;
  }

  return { check, reset, getAchieved };
}
