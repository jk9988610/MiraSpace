#!/usr/bin/env node
/**
 * S5 headless validation: colony links, role emergence, S5 metrics.
 * Quick: node scripts/s5-headless-test.mjs
 * Acceptance: node scripts/s5-headless-test.mjs --acceptance
 */
import { World } from "../site/js/world.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds } from "./test-utils.mjs";

const stage5 = loadPresetSync("stage5-default");
const SEEDS = [42, 7, 99];

function testNoScriptSpawnColony() {
  const w = new World(stage5, 42);
  const pass = w.colony != null && w.colony.count() === 0;
  return {
    name: "no script spawn colony",
    pass,
    detail: { coloniesAtT0: w.colony?.count() ?? 0 },
  };
}

function testVesicleColonyFields() {
  const w = runSimSeconds(stage5, 42, 60);
  const pass = w.vesicle.list.every(
    (v) => v.colonyId == null || typeof v.colonyId === "string",
  ) && w.vesicle.list.every((v) => Array.isArray(v.links));
  return {
    name: "vesicle colonyId + links fields present",
    pass,
    detail: { vesicles: w.vesicle.count() },
  };
}

function testFissionCreatesLinks() {
  const w = new World(stage5, 42);
  const parent = { id: "test-parent", lineageId: 1, age: 80, colonyId: null, links: [] };
  const childA = { id: "test-a", lineageId: 1, age: 0, colonyId: null, links: [] };
  const childB = { id: "test-b", lineageId: 1, age: 0, colonyId: null, links: [] };
  w.colony.onFission(parent, childA, childB, w.vesicle);
  const pass = childA.links.length > 0
    && childB.links.length > 0
    && childA.colonyId != null
    && childA.colonyId === childB.colonyId
    && w.colony.count() > 0;
  return {
    name: "fission creates colony links or registry",
    pass,
    detail: {
      childALinks: childA.links.length,
      colonyId: childA.colonyId,
      colonyCount: w.colony.count(),
    },
  };
}

function testRoleEmergence() {
  const w = runSimSeconds(stage5, 42, 180);
  const roles = new Set();
  for (const v of w.vesicle.list) {
    if (v.chemoton?.role) roles.add(v.chemoton.role);
  }
  const pass = roles.has("default");
  return {
    name: "chemoton role field observable",
    pass,
    detail: { roles: [...roles], vesicles: w.vesicle.count() },
  };
}

function testS5Metrics() {
  const w = runSimSeconds(stage5, 42, 90);
  const pass = w.colony != null
    && w.metrics.multicellularPersistence >= 0
    && w.metrics.divisionOfLabor >= 0
    && w.metrics.developmentalPattern >= 0;
  return {
    name: "S5 metrics recorded",
    pass,
    detail: {
      multicellularPersistence: Number(w.metrics.multicellularPersistence.toFixed(3)),
      divisionOfLabor: Number(w.metrics.divisionOfLabor.toFixed(3)),
      developmentalPattern: Number(w.metrics.developmentalPattern.toFixed(3)),
      colonyCount: w.metrics.colonyCount,
    },
  };
}

function testBareStrandsRemain() {
  const w = runSimSeconds(stage5, 42, 300);
  const bare = w.replicator.list.filter((s) => !s.vesicleId).length;
  const pass = w.replicator.count() > 0 && bare > 0;
  return {
    name: "bare strands still present (not globally disabled)",
    pass,
    detail: { total: w.replicator.count(), bare },
  };
}

function testSeedRun(seed, seconds) {
  const w = runSimSeconds(stage5, seed, seconds);
  return {
    seed,
    seconds,
    multicellularPersistence: Number(w.metrics.multicellularPersistence.toFixed(3)),
    divisionOfLabor: Number(w.metrics.divisionOfLabor.toFixed(3)),
    developmentalPattern: Number(w.metrics.developmentalPattern.toFixed(3)),
    colonyCount: w.metrics.colonyCount,
    vesicles: w.vesicle.count(),
    checks: {
      hasColony: w.colony != null,
      metricsOk: w.metrics.multicellularPersistence >= 0,
    },
  };
}

export function runQuick() {
  const tests = [
    testNoScriptSpawnColony(),
    testVesicleColonyFields(),
    testFissionCreatesLinks(),
    testRoleEmergence(),
    testS5Metrics(),
    testBareStrandsRemain(),
  ];
  return { allPass: tests.every((t) => t.pass), tests, mode: "quick" };
}

export function runAcceptance() {
  const seedRuns = SEEDS.map((seed) => testSeedRun(seed, 600));
  const tests = [
    testNoScriptSpawnColony(),
    testBareStrandsRemain(),
    ...seedRuns.map((run) => ({
      name: `600 sim s colony run (seed=${run.seed})`,
      pass: run.checks.hasColony && run.checks.metricsOk,
      detail: run,
    })),
  ];
  return { allPass: tests.every((t) => t.pass), tests, seedRuns };
}

const acceptance = process.argv.includes("--acceptance");
const result = acceptance ? runAcceptance() : runQuick();
console.log(JSON.stringify(result, null, 2));
process.exit(result.allPass ? 0 : 1);
