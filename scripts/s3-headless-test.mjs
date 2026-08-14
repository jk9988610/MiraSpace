#!/usr/bin/env node
/**
 * S3 headless validation.
 * Full acceptance: node scripts/s3-headless-test.mjs --acceptance
 * Quick (60 sim s, seed=42): node scripts/s3-headless-test.mjs
 * AI default: node scripts/run-suite.mjs --smoke
 */
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds } from "./test-utils.mjs";

const stage3 = loadPresetSync("stage3-default");
const SEEDS = [42, 7, 99];
const SIM_SECONDS = 600;

function testNoScriptSpawn() {
  const w = new World(stage3, 42);
  const pass = w.vesicle.count() === 0;
  return {
    name: "no script spawn vesicle",
    pass,
    detail: `vesicles at t0: ${w.vesicle.count()}`,
  };
}

function testBareStrandsEnabled() {
  const w = runSimSeconds(stage3, 42, 120);
  const bare = w.replicator.list.filter((s) => !s.vesicleId).length;
  const pass = w.replicator.count() > 0 && bare > 0;
  return {
    name: "bare strands still replicate (not disabled)",
    pass,
    detail: { total: w.replicator.count(), bare },
  };
}

function testSeedRun(seed, seconds) {
  const w = runSimSeconds(stage3, seed, seconds);
  const interior = w.vesicle.interiorStrandCount(w.replicator);
  const maxV = stage3.vesicle.maxCount;
  const maxStrands = stage3.replicator.maxPopulation;
  const m = w.metrics.formatHud();

  return {
    seed,
    seconds,
    vesicles: w.vesicle.count(),
    interior,
    fissionEvents: w.metrics.fissionEvents,
    encapsulationGain: Number(w.metrics.encapsulationGain.toFixed(3)),
    parasiteLoad: Number(w.metrics.parasiteLoad.toFixed(3)),
    checks: {
      nucleation: w.vesicle.count() > 0,
      capture: interior > 0,
      fission: w.metrics.fissionEvents >= 1,
      encapsulation: w.metrics.encapsulationGain > 1 || interior > 0,
      noLeaks: w.vesicle.count() <= maxV
        && w.replicator.count() <= maxStrands
        && w.metrics._historyS3.length <= 205,
    },
    metrics: {
      encapsulationGain: Number(m.encapsulationGain?.toFixed(3)),
      parasiteLoad: Number(m.parasiteLoad?.toFixed(3)),
      fissionEvents: m.fissionEvents,
      vesicleCount: m.vesicleCount,
      strandCount: m.strandCount,
    },
  };
}

export function runAcceptance() {
  const seedRuns = SEEDS.map((seed) => testSeedRun(seed, SIM_SECONDS));

  const tests = [
    testNoScriptSpawn(),
    testBareStrandsEnabled(),
    ...seedRuns.flatMap((run) => [
      {
        name: `emergent nucleation (seed=${run.seed}, ${SIM_SECONDS}s)`,
        pass: run.checks.nucleation,
        detail: `${run.vesicles} vesicles`,
      },
      {
        name: `strand capture into interior (seed=${run.seed})`,
        pass: run.checks.capture,
        detail: `${run.interior} interior strands`,
      },
      {
        name: `≥1 fission within ${SIM_SECONDS}s (seed=${run.seed})`,
        pass: run.checks.fission,
        detail: { fissionEvents: run.fissionEvents, vesicles: run.vesicles },
      },
      {
        name: `encapsulationGain > 1 or interior strands (seed=${run.seed})`,
        pass: run.checks.encapsulation,
        detail: { encapsulationGain: run.encapsulationGain, interior: run.interior },
      },
      {
        name: `no leaks / caps (seed=${run.seed})`,
        pass: run.checks.noLeaks,
        detail: {
          vesicles: run.vesicles,
          maxVesicles: stage3.vesicle.maxCount,
          strands: run.metrics.strandCount,
          maxStrands: stage3.replicator.maxPopulation,
        },
      },
    ]),
  ];

  const allPass = tests.every((t) => t.pass);
  return { allPass, tests, seedRuns };
}

export function runQuick() {
  const run = testSeedRun(42, 60);
  const tests = [
    testNoScriptSpawn(),
    {
      name: "emergent nucleation (seed=42, 60 sim s)",
      pass: run.checks.nucleation,
      detail: `${run.vesicles} vesicles`,
    },
    {
      name: "vesicle nucleation or capture (60 sim s)",
      pass: run.checks.nucleation || run.checks.capture,
      detail: { vesicles: run.vesicles, interior: run.interior },
    },
  ];
  return { allPass: tests.every((t) => t.pass), tests, mode: "quick", seedRun: run };
}

const acceptance = process.argv.includes("--acceptance");
const result = acceptance ? runAcceptance() : runQuick();
console.log(JSON.stringify(result, null, 2));
process.exit(result.allPass ? 0 : 1);
