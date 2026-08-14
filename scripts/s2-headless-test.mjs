#!/usr/bin/env node
/**
 * S2 headless validation.
 * Full acceptance: node scripts/s2-headless-test.mjs --acceptance
 * Quick (60 sim s): node scripts/s2-headless-test.mjs
 * AI default: node scripts/run-suite.mjs --smoke
 */
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds } from "./test-utils.mjs";

const stage2 = loadPresetSync("stage2-default");
const stage2HighMu = loadPresetSync("stage2-error-threshold");

function testNoScriptSpawn() {
  const w = new World(stage2, 42);
  const pass = w.replicator.count() === 0 && stage2.replicator.initialCount === 0;
  return {
    name: "no script spawn (initialCount=0)",
    pass,
    detail: `strands at t0: ${w.replicator.count()}`,
  };
}

function testEmergentNucleation(seconds) {
  const w = runSimSeconds(stage2, 42, seconds);
  const pass = w.replicator.count() > 0;
  return {
    name: `emergent nucleation within ${seconds} sim s`,
    pass,
    detail: `${w.replicator.count()} strands`,
  };
}

function testHeritability() {
  const w = runSimSeconds(stage2, 42, 500);
  const replicationsObserved = w.replicator.list.some((s) => s.replicationSuccesses > 0);
  const pass = w.metrics.heritability > 0 && replicationsObserved;
  return {
    name: "heritability > 0 after replication",
    pass,
    detail: {
      heritability: Number(w.metrics.heritability.toFixed(3)),
      heritabilityAvg: Number(w.metrics.heritabilityAvg.toFixed(3)),
      replicationsObserved,
      strands: w.replicator.count(),
    },
  };
}

function testErrorThresholdContrast() {
  const seconds = 360;
  const seed = 42;
  const low = runSimSeconds(stage2, seed, seconds);
  const high = runSimSeconds(stage2HighMu, seed, seconds);

  const lowInfo = low.metrics.informationAccumulationAvg;
  const highInfo = high.metrics.informationAccumulationAvg;
  const lowLen = low.replicator.meanLength();
  const highLen = high.replicator.meanLength();
  const lowL0 = low.replicator.L0Baseline();

  const pass = lowInfo > highInfo || (lowLen > highLen && low.replicator.count() >= 3);
  return {
    name: "error threshold contrast (low μ vs high μ)",
    pass,
    detail: {
      lowMutationRate: stage2.replicator.mutationRate,
      highMutationRate: stage2HighMu.replicator.mutationRate,
      low: {
        informationAccumulationAvg: Number(lowInfo.toFixed(3)),
        meanLength: Number(lowLen.toFixed(3)),
        ratio: Number((lowLen / lowL0).toFixed(3)),
        strands: low.replicator.count(),
      },
      high: {
        informationAccumulationAvg: Number(highInfo.toFixed(3)),
        meanLength: Number(highLen.toFixed(3)),
        ratio: Number((highLen / high.replicator.L0Baseline()).toFixed(3)),
        strands: high.replicator.count(),
      },
    },
  };
}

function testLongRun600s() {
  const w = runSimSeconds(stage2, 42, 600);
  const maxPop = stage2.replicator.maxPopulation;
  const pass = w.replicator.count() <= maxPop && w.metrics._historyS2.length <= 205;
  return {
    name: "600 sim s long run (strand cap + history)",
    pass,
    detail: {
      strands: w.replicator.count(),
      maxPopulation: maxPop,
      historyLen: w.metrics._historyS2.length,
      metrics: w.metrics.formatHud(),
    },
  };
}

export function runAcceptance() {
  const tests = [
    testNoScriptSpawn(),
    testEmergentNucleation(300),
    testHeritability(),
    testErrorThresholdContrast(),
    testLongRun600s(),
  ];
  const allPass = tests.every((t) => t.pass);
  const errorContrast = tests.find((t) => t.name.startsWith("error threshold"));
  return {
    allPass,
    tests,
    errorThresholdContrast: errorContrast?.detail,
    exampleMetrics: tests.find((t) => t.name.startsWith("600 sim"))?.detail?.metrics,
  };
}

export function runQuick() {
  const tests = [
    testNoScriptSpawn(),
    testEmergentNucleation(60),
  ];
  return { allPass: tests.every((t) => t.pass), tests, mode: "quick" };
}

const acceptance = process.argv.includes("--acceptance");
const result = acceptance ? runAcceptance() : runQuick();
console.log(JSON.stringify(result, null, 2));
process.exit(result.allPass ? 0 : 1);
