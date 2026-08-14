#!/usr/bin/env node
/**
 * S3 headless validation: nucleation, capture, fission, no leaks.
 * Run: node scripts/s3-headless-test.mjs
 */
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";

const stage3 = loadPresetSync("stage3-default");
const SEEDS = [42, 7, 99];
const SIM_SECONDS = 600;

function runTicks(world, n) {
  for (let i = 0; i < n; i += 1) {
    world.tick();
  }
}

function runSimSeconds(preset, seed, seconds) {
  const world = new World(preset, seed);
  const ticks = Math.floor(seconds / world.dt);
  runTicks(world, ticks);
  return world;
}

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

function testSeedRun(seed) {
  const w = runSimSeconds(stage3, seed, SIM_SECONDS);
  const interior = w.vesicle.interiorStrandCount(w.replicator);
  const maxV = stage3.vesicle.maxCount;
  const maxStrands = stage3.replicator.maxPopulation;
  const m = w.metrics.formatHud();

  return {
    seed,
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

const seedRuns = SEEDS.map((seed) => testSeedRun(seed));

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
    {
      name: `600 sim s metrics snapshot (seed=${run.seed})`,
      pass: true,
      detail: { metrics: run.metrics },
    },
  ]),
];

const coreTests = tests.filter((t) => !t.name.startsWith("600 sim s"));
const allPass = coreTests.every((t) => t.pass);

console.log(JSON.stringify({ allPass, tests, seedRuns }, null, 2));
process.exit(allPass ? 0 : 1);
