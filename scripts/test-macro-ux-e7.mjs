#!/usr/bin/env node
/**
 * E7: macro UX helpers (tick-fast unit tests).
 * Run: node scripts/test-macro-ux-e7.mjs
 */
import { World } from "../site/js/world.js";
import { Colony } from "../site/js/colony.js";
import { Replicator } from "../site/js/replicator.js";
import { Chemoton } from "../site/js/chemoton.js";
import { buildExpressionHeader } from "../site/js/gene-expression.js";
import {
  envelopeFromMembers,
  isProducerArchetype,
  macroStyleForArchetype,
  archetypeMobility,
} from "../site/js/macro-visual.js";
import { findVesicleNear } from "../site/js/magnifier-modal.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { createRng } from "../site/js/camera.js";

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

test("producer archetypes have mobility 0", () => {
  if (!isProducerArchetype("cyanophyte")) throw new Error("cyanophyte");
  if (archetypeMobility("cyanophyte") !== 0) throw new Error("mobility");
  if (archetypeMobility("herbivore") <= 0) throw new Error("herbivore should move");
});

test("producer macro style is green-tinted", () => {
  const style = macroStyleForArchetype("cyanophyte");
  if (!style.fill.includes("168") && !style.fill.includes("150")) {
    throw new Error(`fill not greenish: ${style.fill}`);
  }
});

test("envelope requires >=3 members", () => {
  const members = [
    { x: 100, y: 200, radius: 18, chemoton: { archetype: "cyanophyte" } },
    { x: 130, y: 210, radius: 20, chemoton: { archetype: "cyanophyte" } },
    { x: 115, y: 235, radius: 19, chemoton: { archetype: "herbivore" } },
  ];
  const envelope = envelopeFromMembers(members, preset.world.width, preset.world.height);
  if (!envelope || envelope.memberCount < 3) throw new Error("bad envelope");
  if (envelope.radius < 20) throw new Error(`radius ${envelope.radius}`);
});

test("colony drawLinks is no-op (E7)", () => {
  const colony = new Colony(preset, preset.world.width, preset.world.height);
  colony.drawLinks(null, null, null);
});

test("findVesicleNear picks closest vesicle", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  w.vesicle.list.push({
    id: "v1",
    x: 300,
    y: 400,
    radius: 20,
    interior: new Set(),
  });
  const hit = findVesicleNear(w, 305, 402);
  if (!hit || hit.id !== "v1") throw new Error("miss");
});

test("producer interior strands have zero mobility cap", () => {
  const rng = createRng(99);
  const rep = new Replicator(preset, preset.world.width, preset.world.height, rng);
  const ves = {
    id: "v-prod",
    x: 200,
    y: 300,
    chemoton: { archetype: "cyanophyte", effectiveArchetype: "cyanophyte" },
  };
  const strand = {
    id: "s1",
    x: 200,
    y: 300,
    vx: 0.5,
    vy: 0.4,
    energy: 1,
    vesicleId: "v-prod",
    sequence: buildExpressionHeader(0, 0, 0, 4),
  };
  rep.list.push(strand);
  const fakeVesicle = { byId: (id) => (id === "v-prod" ? ves : null) };
  const fields = {
    sampleEnergy: () => 0.5,
    consumeEnergy: () => 0,
  };
  rep._integrate(1, fields, rng, fakeVesicle);
  if (strand.vx !== 0 || strand.vy !== 0) throw new Error("strand still moving");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
