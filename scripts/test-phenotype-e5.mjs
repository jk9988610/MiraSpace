#!/usr/bin/env node
/**
 * E5: phenotypic differentiation (tick-fast unit + engineered colony).
 * Run: node scripts/test-phenotype-e5.mjs
 */
import { World } from "../site/js/world.js";
import { buildSnapshotText } from "../site/js/data-export.js";
import {
  buildExpressionHeader,
  decodeSequence,
  computeEffectivePhenotype,
} from "../site/js/gene-expression.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runTicks } from "./test-utils.mjs";

const earthPreset = loadPresetSync("stage-earth-default");

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

/**
 * @param {object} preset
 * @param {number} seed
 */
function engineeredColony(preset, seed) {
  const w = new World({ ...preset, _name: "stage-earth-default" }, seed);
  const seq = buildExpressionHeader(0, 0, 8, 4);
  const strand = { id: "strand-e5", sequence: [...seq] };
  w.replicator.list.push(strand);

  const colony = w.colony._createColony(1);
  w.colony.list.push(colony);

  const members = [];
  for (let i = 0; i < 3; i += 1) {
    const v = {
      id: `ves-e5-${i}`,
      x: 200 + i * 120,
      y: 300,
      radius: 22,
      interior: new Set(["strand-e5"]),
      biomass: 0.35,
      colonyId: colony.id,
      links: [],
      lineageId: 1,
      age: 10,
      chemoton: w.chemoton.createState(w.rng),
    };
    v.chemoton.metabolicFlux = 0.75;
    members.push(v);
    w.vesicle.list.push(v);
    colony.memberVesicleIds.push(v.id);
  }

  w.colony._addLink(members[0], members[1].id, 0.85);
  w.colony._addLink(members[1], members[2].id, 0.85);

  const idx0 = w.fields.gridIndex(members[0].x, members[0].y);
  const idx2 = w.fields.gridIndex(members[2].x, members[2].y);
  w.fields.DOC[idx0] = 0.85;
  w.fields.DOC[idx2] = 0.04;

  return { w, colony, members, seq };
}

test("R bit3 enables phenotypic differentiation", () => {
  const decoded = decodeSequence(buildExpressionHeader(0, 0, 8, 0));
  if (!decoded.allowsPhenotypicDiff) throw new Error("allowsPhenotypicDiff false");
});

test("high local DOC shifts effective archetype", () => {
  const decoded = decodeSequence(buildExpressionHeader(0, 0, 8, 0));
  const eff = computeEffectivePhenotype(decoded, {
    localDOC: 0.9,
    meanDOC: 0.1,
    localLight: 1,
    meanLight: 1,
  });
  if (eff.effectiveArchetype !== "anaerobe_decomposer") {
    throw new Error(`got ${eff.effectiveArchetype}`);
  }
});

test("colony updatePhenotypes yields >=2 effective archetypes", () => {
  const { w, members } = engineeredColony(earthPreset, 42);
  w.colony.updatePhenotypes(w.vesicle, w.fields, w.replicator);
  const archs = new Set(members.map((m) => m.chemoton.effectiveArchetype));
  if (archs.size < 2) throw new Error(`archs=${[...archs].join(",")}`);
});

test("sequence not mutated by phenotype update", () => {
  const { w, seq } = engineeredColony(earthPreset, 7);
  w.colony.updatePhenotypes(w.vesicle, w.fields, w.replicator);
  const strand = w.replicator.list.find((s) => s.id === "strand-e5");
  if (JSON.stringify(strand.sequence) !== JSON.stringify(seq)) {
    throw new Error("sequence changed");
  }
});

test("divisionOfLabor and richness detect phenotypic split", () => {
  const { w } = engineeredColony(earthPreset, 99);
  w.colony.updatePhenotypes(w.vesicle, w.fields, w.replicator);
  if (w.colony.divisionOfLaborShare(w.vesicle) <= 0) throw new Error("labor share 0");
  if (w.colony.phenotypicArchetypeRichness(w.vesicle) < 2) throw new Error("richness < 2");
});

test("metrics record phenotypic richness within few ticks", () => {
  const { w } = engineeredColony(earthPreset, 42);
  runTicks(w, 15);
  if (w.metrics.phenotypicArchetypeRichness < 2) {
    throw new Error(`richness=${w.metrics.phenotypicArchetypeRichness}`);
  }
});

test("snapshot export includes effectiveArchetype", () => {
  const { w } = engineeredColony(earthPreset, 42);
  runTicks(w, 3);
  const text = buildSnapshotText({
    presetName: "stage-earth-default",
    stageLabel: "米拉地球",
    seed: w.seed,
    simTime: w.simTime,
    tickCount: w.tickCount,
    timeScale: 1,
    paused: false,
    metrics: w.metrics,
    world: w,
  });
  if (!text.includes("effectiveArchetype=")) throw new Error("missing effectiveArchetype in export");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
