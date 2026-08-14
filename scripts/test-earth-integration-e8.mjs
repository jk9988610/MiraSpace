#!/usr/bin/env node
/**
 * E8: earth tab integration (tick-fast, no DOM).
 * Run: node scripts/test-earth-integration-e8.mjs
 */
import { STAGE_TABS, tabForPreset } from "../site/js/stage-nav.js";
import {
  EARTH_MILESTONE_CONDITIONS,
  STAGE_TREE_META,
  evaluateCondition,
} from "../site/js/milestone-conditions.js";
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";

const preset = loadPresetSync("stage-earth-default");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

test("STAGE_TABS includes米拉地球 tab", () => {
  const earth = STAGE_TABS.find((t) => t.id === "earth");
  if (!earth) throw new Error("missing earth tab");
  if (earth.preset !== "stage-earth-default") throw new Error("preset");
  if (earth.stageKey !== "earth") throw new Error("stageKey");
  if (!earth.hudStages.includes("earth")) throw new Error("hudStages earth");
  if (!earth.hudStages.includes("s5")) throw new Error("hudStages s5");
});

test("tabForPreset resolves earth aliases", () => {
  for (const name of ["stage-earth-default", "stage-earth", "earth"]) {
    const tab = tabForPreset(name);
    if (!tab || tab.id !== "earth") throw new Error(name);
  }
});

test("earth milestone definitions complete", () => {
  if (EARTH_MILESTONE_CONDITIONS.length < 4) throw new Error("conditions");
  if (!STAGE_TREE_META.earth?.label) throw new Error("tree meta");
  for (const def of EARTH_MILESTONE_CONDITIONS) {
    if (def.stageKey !== "earth") throw new Error(def.id);
    const threshold = def.getThreshold(preset);
    if (threshold == null) throw new Error(`${def.id} threshold`);
  }
});

test("milestone evaluateCondition works on loaded world", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  const hud = w.metrics.formatHud();
  const def = EARTH_MILESTONE_CONDITIONS[0];
  const result = evaluateCondition(def, hud, preset);
  if (typeof result.met !== "boolean") throw new Error("met type");
});

test("stage-earth-default world boots with earth modules", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  if (!w.earthProfile) throw new Error("earthProfile");
  if (!w.fields.ecologyEnabled) throw new Error("ecology");
  if (!w.metrics.earthEnabled) throw new Error("metrics earth");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
