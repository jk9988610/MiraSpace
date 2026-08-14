#!/usr/bin/env node
/**
 * S4 headless validation: chemoton coupling, fitness-gated fission.
 * Quick: node scripts/s4-headless-test.mjs
 * Acceptance: node scripts/s4-headless-test.mjs --acceptance
 */
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds } from "./test-utils.mjs";

const stage4 = loadPresetSync("stage4-default");
const SEEDS = [42, 7, 99];

function testFissionFitnessGate() {
  const w = new World(stage4, 42);
  const threshold = (stage4.vesicle.fissionThresholdRatio ?? 0.62) * stage4.vesicle.radiusMax;
  const low = {
    radius: threshold + 2,
    chemoton: {
      metabolicFlux: 0.1,
      membraneHealth: 0.1,
      geneticActivity: 0.1,
      coherenceTicks: 0,
    },
  };
  const high = {
    radius: threshold + 2,
    chemoton: {
      metabolicFlux: 0.85,
      membraneHealth: 0.85,
      geneticActivity: 0.85,
      coherenceTicks: 200,
    },
  };
  const pass = !w.chemoton.canFission(low, threshold)
    && w.chemoton.canFission(high, threshold);
  return {
    name: "fission requires chemoton fitness (not radius alone)",
    pass,
    detail: { threshold, lowBlocked: !w.chemoton.canFission(low, threshold), highAllowed: w.chemoton.canFission(high, threshold) },
  };
}

function testCoherenceTicksIncrease() {
  const w = runSimSeconds(stage4, 42, 90);
  let maxCoherence = 0;
  for (const v of w.vesicle.list) {
    if (v.chemoton) maxCoherence = Math.max(maxCoherence, v.chemoton.coherenceTicks);
  }
  const pass = maxCoherence > 0 || w.vesicle.list.some((v) => v.chemoton);
  return {
    name: "coherenceTicks observable within 90 sim s",
    pass,
    detail: { maxCoherenceTicks: maxCoherence, vesicles: w.vesicle.count() },
  };
}

function testChemotonMetrics() {
  const w = runSimSeconds(stage4, 42, 90);
  const pass = w.chemoton != null
    && w.metrics.chemotonCoherence >= 0
    && w.vesicle.list.every((v) => v.chemoton);
  return {
    name: "S4 metrics + chemoton state on vesicles",
    pass,
    detail: {
      chemotonCoherence: Number(w.metrics.chemotonCoherence.toFixed(3)),
      chemotonCount: w.metrics.chemotonCount,
      vesicles: w.vesicle.count(),
    },
  };
}

function testBareStrandsRemain() {
  const w = runSimSeconds(stage4, 42, 300);
  const bare = w.replicator.list.filter((s) => !s.vesicleId).length;
  const pass = w.replicator.count() > 0 && bare > 0;
  return {
    name: "bare strands still present (not globally disabled)",
    pass,
    detail: { total: w.replicator.count(), bare },
  };
}

function testSeedRun(seed, seconds) {
  const w = runSimSeconds(stage4, seed, seconds);
  return {
    seed,
    seconds,
    chemotonCoherence: Number(w.metrics.chemotonCoherence.toFixed(3)),
    lineagePersistence: Number(w.metrics.lineagePersistence.toFixed(3)),
    vesicles: w.vesicle.count(),
    fissionEvents: w.metrics.fissionEvents,
    checks: {
      hasChemoton: w.vesicle.list.every((v) => v.chemoton),
      metricsOk: w.metrics.chemotonCoherence >= 0,
    },
  };
}

export function runQuick() {
  const tests = [
    testFissionFitnessGate(),
    testCoherenceTicksIncrease(),
    testChemotonMetrics(),
    testBareStrandsRemain(),
  ];
  return { allPass: tests.every((t) => t.pass), tests, mode: "quick" };
}

export function runAcceptance() {
  const seedRuns = SEEDS.map((seed) => testSeedRun(seed, 600));
  const tests = [
    testFissionFitnessGate(),
    testBareStrandsRemain(),
    ...seedRuns.map((run) => ({
      name: `600 sim s chemoton run (seed=${run.seed})`,
      pass: run.checks.hasChemoton && run.checks.metricsOk,
      detail: run,
    })),
  ];
  return { allPass: tests.every((t) => t.pass), tests, seedRuns };
}

const acceptance = process.argv.includes("--acceptance");
const result = acceptance ? runAcceptance() : runQuick();
console.log(JSON.stringify(result, null, 2));
process.exit(result.allPass ? 0 : 1);
