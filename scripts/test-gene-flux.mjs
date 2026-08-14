#!/usr/bin/env node
/**
 * E3: gene flux coupling tests (engineered cyanophyte vesicle).
 */
import { Fields } from "../site/js/fields.js";
import { Chemoton } from "../site/js/chemoton.js";
import {
  applyGeneFluxForVesicle,
  estimateCarbonPool,
} from "../site/js/gene-flux.js";
import { buildExpressionHeader } from "../site/js/gene-expression.js";
import { loadPresetSync } from "./preset-loader.mjs";

const preset = loadPresetSync("stage-earth-default");
const fields = new Fields(preset, preset.world.width, preset.world.height);
const chemoton = new Chemoton(preset);

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

function assertTrue(v) {
  if (!v) throw new Error("expected true");
}

const replicator = {
  list: [{
    id: "strand-test",
    sequence: buildExpressionHeader(0, 0, 0, 4),
  }],
};

const vesicle = {
  list: [],
  byId: () => null,
};

const v = {
  id: "vesicle-1",
  x: 200,
  y: 200,
  radius: 20,
  interior: new Set(["strand-test"]),
  biomass: 0.2,
  chemoton: chemoton.createState({ next: () => 0.5 }),
};

vesicle.list.push(v);

const o2Before = fields.globalO2;
const stats = { geneFluxTicks: 0, geneFluxO2Delta: 0 };

for (let i = 0; i < 120; i += 1) {
  applyGeneFluxForVesicle(
    preset,
    v,
    fields,
    replicator,
    vesicle,
    preset.world.width,
    preset.world.height,
    preset.sim.dt,
    stats,
  );
}

test("gene flux ticks on cyanophyte vesicle", () => {
  assertTrue(stats.geneFluxTicks > 0);
});

test("cyanophyte increases O2 flux sum", () => {
  assertTrue(stats.geneFluxO2Delta > 0);
});

test("archetype stored on chemoton", () => {
  assertTrue(v.chemoton.archetype === "cyanophyte");
});

test("carbon pool finite after flux", () => {
  const pool = estimateCarbonPool(fields, vesicle);
  assertTrue(Number.isFinite(pool) && pool > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
