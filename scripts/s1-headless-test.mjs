#!/usr/bin/env node
/**
 * S1 headless validation: seed reproducibility, pause, 10 min long run.
 * Run: node scripts/s1-headless-test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { World } from "../site/js/world.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const preset = JSON.parse(readFileSync(join(__dirname, "../site/data/presets/stage0-default.json"), "utf8"));

function stateFingerprint(world) {
  const parts = world.particles.list
    .map((p) => `${p.type}:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.vx.toFixed(3)},${p.vy.toFixed(3)},${p.energy.toFixed(4)}`)
    .sort();
  return `${world.tickCount}|${parts.join(";")}`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function runTicks(world, n) {
  for (let i = 0; i < n; i += 1) {
    world.tick();
  }
}

function testSeedReproducibility() {
  const seed = 42;
  const ticks = 500;
  const a = new World(preset, seed);
  runTicks(a, ticks);
  const fpA = stateFingerprint(a);

  const b = new World(preset, seed);
  runTicks(b, ticks);
  const fpB = stateFingerprint(b);

  const pass = fpA === fpB;
  return {
    name: "seed reproducibility (?seed=42, 500 ticks)",
    pass,
    detail: pass ? `hash ${hashString(fpA)}` : "fingerprints differ",
  };
}

function testInitialSnapshotReproducibility() {
  const seed = 99;
  const snap = () => {
    const w = new World(preset, seed);
    return w.particles.list
      .map((p) => `${p.type}:${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .sort()
      .join("|");
  };
  const pass = snap() === snap();
  return {
    name: "initial distribution reproducibility (seed=99)",
    pass,
    detail: pass ? "initial positions match across runs" : "initial layout differs",
  };
}

function testPause() {
  const w = new World(preset, 42);
  runTicks(w, 50);
  w.togglePause();
  const tickBefore = w.tickCount;
  const metricsBefore = { ...w.metrics.formatHud() };
  for (let i = 0; i < 100; i += 1) {
    w.stepFrame(0.016);
  }
  const pass = w.tickCount === tickBefore
    && w.metrics.formatHud().clusterIndex === metricsBefore.clusterIndex;
  return {
    name: "pause freezes tick and metrics",
    pass,
    detail: pass ? `tick stayed at ${tickBefore}` : "sim advanced while paused",
  };
}

function testLongRun10Min() {
  const w = new World(preset, 42);
  const targetSeconds = 600;
  const targetTicks = Math.floor(targetSeconds / w.dt);
  const maxCount = preset.particles.maxCount;
  const historyCap = Math.ceil(preset.metricsThresholds.sustainSeconds / (preset.metricsThresholds.updateEveryTicks * w.dt)) + 5;

  let maxParticles = w.particles.count();
  for (let i = 0; i < targetTicks; i += 1) {
    w.tick();
    maxParticles = Math.max(maxParticles, w.particles.count());
  }

  const pass = w.particles.count() <= maxCount
    && maxParticles <= maxCount
    && w.metrics._history.length <= historyCap;

  const m = w.metrics.formatHud();
  return {
    name: "10 min long run (600 sim s)",
    pass,
    detail: {
      ticks: w.tickCount,
      simTime: w.simTime.toFixed(1),
      particles: w.particles.count(),
      maxParticles,
      historyLen: w.metrics._history.length,
      historyCap,
      metrics: {
        clusterIndex: Number(m.clusterIndex.toFixed(3)),
        clusterAvg: Number(m.clusterAvg.toFixed(3)),
        autocatalyticScore: Number(m.autocatalyticScore.toFixed(3)),
        autocatalyticAvg: Number(m.autocatalyticAvg.toFixed(3)),
        negentropyFlux: Number(m.negentropyFlux.toFixed(3)),
        negentropyAvg: Number(m.negentropyAvg.toFixed(3)),
      },
      typeCounts: w.particles.typeCountsSnapshot(),
    },
  };
}

function testParticleCap() {
  const w = new World(preset, 7);
  runTicks(w, 2000);
  const pass = w.particles.count() <= preset.particles.maxCount;
  return {
    name: "particle count stays <= maxCount",
    pass,
    detail: `${w.particles.count()} / ${preset.particles.maxCount}`,
  };
}

const tests = [
  testSeedReproducibility(),
  testInitialSnapshotReproducibility(),
  testPause(),
  testParticleCap(),
  testLongRun10Min(),
];

const allPass = tests.every((t) => t.pass);
const longRun = tests.find((t) => t.name.startsWith("10 min"));

console.log(JSON.stringify({ allPass, tests, exampleMetrics: longRun?.detail?.metrics, exampleRun: longRun?.detail }, null, 2));
process.exit(allPass ? 0 : 1);
