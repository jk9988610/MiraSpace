#!/usr/bin/env node
/**
 * Earth ecology headless validation (E4).
 * Quick: node scripts/s-earth-headless-test.mjs
 * Acceptance: node scripts/s-earth-headless-test.mjs --acceptance
 */
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds } from "./test-utils.mjs";
import {
  carbonBudgetWithinTolerance,
  estimateCarbonPool,
} from "../site/js/gene-flux.js";

const earthPreset = loadPresetSync("stage-earth-default");
const SEEDS = [42, 7, 99];

function testEcologyModules() {
  const w = new World({ ...earthPreset, _name: "stage-earth-default" }, 42);
  const pass = w.fields.ecologyEnabled
    && w.metrics.earthEnabled
    && w.preset.geneExpression != null;
  return {
    name: "earth ecology modules loaded",
    pass,
    detail: { ecology: w.fields.ecologyEnabled, metricsEarth: w.metrics.earthEnabled },
  };
}

function testSeedRun(seed, seconds) {
  const preset = { ...earthPreset, _name: "stage-earth-default" };
  const w0 = new World(preset, seed);
  const carbonBefore = estimateCarbonPool(w0.fields, w0.vesicle);
  const o2Start = w0.fields.globalO2;

  const w = runSimSeconds(preset, seed, seconds);
  const carbonAfter = estimateCarbonPool(w.fields, w.vesicle);
  const m = w.metrics;

  const checks = {
    cyanophyteSeen: m.cyanophytePresence >= 1,
    heterotrophAlive: m.heterotrophPresence >= 1,
    o2Rise: m.globalO2Rise >= 0.05,
    trophicRich: m.trophicRichness >= 2,
    carbonOk: carbonBudgetWithinTolerance(carbonBefore, carbonAfter, 0.05),
    geneFlux: (w.chemoton?.geneFluxTicks ?? 0) > 0,
  };

  return {
    seed,
    seconds,
    globalO2Start: Number(o2Start.toFixed(4)),
    globalO2End: Number(w.fields.globalO2.toFixed(4)),
    globalO2Rise: Number(m.globalO2Rise.toFixed(4)),
    trophicRichness: m.trophicRichness,
    cyanophytePresence: m.cyanophytePresence,
    heterotrophPresence: m.heterotrophPresence,
    geneFluxTicks: w.chemoton?.geneFluxTicks ?? 0,
    checks,
  };
}

export function runQuick() {
  const run = testSeedRun(42, 90);
  const tests = [
    testEcologyModules(),
    {
      name: "90 sim s earth metrics recorded",
      pass: run.trophicRichness >= 1 && run.geneFluxTicks > 0,
      detail: run,
    },
  ];
  return { allPass: tests.every((t) => t.pass), tests, mode: "quick" };
}

export function runAcceptance() {
  const seedRuns = SEEDS.map((seed) => testSeedRun(seed, 600));
  const tests = [
    testEcologyModules(),
    ...seedRuns.map((run) => ({
      name: `600 sim s earth closure (seed=${run.seed})`,
      pass: Object.values(run.checks).every(Boolean),
      detail: run,
    })),
  ];
  return { allPass: tests.every((t) => t.pass), tests, seedRuns };
}

const acceptance = process.argv.includes("--acceptance");
const result = acceptance ? runAcceptance() : runQuick();
console.log(JSON.stringify(result, null, 2));
process.exit(result.allPass ? 0 : 1);
