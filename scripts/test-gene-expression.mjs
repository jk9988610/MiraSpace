#!/usr/bin/env node
/**
 * E1: deterministic tests for gene-expression decode + flux (no field coupling).
 * Run: node scripts/test-gene-expression.mjs
 */
import {
  buildExpressionHeader,
  computeEnvGate,
  computeExpressionStrength,
  computeFlux,
  computePredatorTransfer,
  computeEffectivePhenotype,
  decodeSequence,
  mergeGeneExpressionConfig,
  netOrganicCarbonGain,
  resolveArchetype,
} from "../site/js/gene-expression.js";

const cfg = mergeGeneExpressionConfig({});

let passed = 0;
let failed = 0;

/** @param {string} name @param {() => void} fn */
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

/** @param {number} a @param {number} b @param {number} [eps] */
function assertNear(a, b, eps = 1e-9) {
  if (Math.abs(a - b) > eps) {
    throw new Error(`expected ${b}, got ${a}`);
  }
}

/** @param {boolean} v */
function assertTrue(v) {
  if (!v) throw new Error("expected true");
}

/** @param {unknown} a @param {unknown} b */
function assertEqual(a, b) {
  if (a !== b) throw new Error(`expected ${b}, got ${a}`);
}

test("buildExpressionHeader roundtrip cyanophyte", () => {
  const seq = buildExpressionHeader(0, 0, 0, 4);
  assertEqual(seq.length, 16);
  const d = decodeSequence(seq);
  assertEqual(d.archetype, "cyanophyte");
  assertTrue(d.canExpress);
  assertEqual(d.isProducer, true);
  assertEqual(d.mobility, 0);
});

test("herbivore archetype decode", () => {
  const seq = buildExpressionHeader(2, 1, 0, 0);
  const d = decodeSequence(seq);
  assertEqual(d.archetype, "herbivore");
  assertEqual(d.metabolicMode, "aero_resp");
  assertEqual(d.trophicMode, "herbivore");
});

test("illegal oxy_photo + predator → leaky_heterotroph", () => {
  const seq = buildExpressionHeader(0, 2, 0, 0);
  const d = decodeSequence(seq);
  assertEqual(d.archetype, "leaky_heterotroph");
});

test("short sequence cannot express", () => {
  const d = decodeSequence([1, 0, 1]);
  assertEqual(d.canExpress, false);
  assertEqual(d.archetype, "leaky_heterotroph");
});

test("resolveArchetype table", () => {
  assertEqual(resolveArchetype(0, 0), "cyanophyte");
  assertEqual(resolveArchetype(1, 0), "chemo_producer");
  assertEqual(resolveArchetype(2, 1), "herbivore");
  assertEqual(resolveArchetype(2, 2), "predator");
  assertEqual(resolveArchetype(3, 3), "anaerobe_decomposer");
  assertEqual(resolveArchetype(4, 3), "aerobe_decomposer");
});

test("oxy_photo flux signs", () => {
  const d = decodeSequence(buildExpressionHeader(0, 0, 0, 0));
  const envGate = computeEnvGate(d, { light: 1, CO2: 0.5, O2: 0.02 }, cfg);
  const E = computeExpressionStrength(0.8, 1, envGate, false, cfg);
  const flux = computeFlux(d, E, 1, cfg);
  assertTrue(flux.dDOC > 0);
  assertTrue(flux.dCO2 < 0);
  assertTrue(flux.dO2 > 0);
  assertTrue(flux.dWaste > 0);
});

test("herbivore flux signs", () => {
  const d = decodeSequence(buildExpressionHeader(2, 1, 0, 0));
  const envGate = computeEnvGate(d, { O2: 0.3, DOC: 0.4 }, cfg);
  const E = computeExpressionStrength(0.7, 1, envGate, false, cfg);
  const flux = computeFlux(d, E, 0.8, cfg);
  assertTrue(flux.dDOC < 0);
  assertTrue(flux.dCO2 > 0);
  assertTrue(flux.dO2 < 0);
});

test("no light → oxy_photo envGate ≈ 0", () => {
  const d = decodeSequence(buildExpressionHeader(0, 0, 0, 0));
  const gate = computeEnvGate(d, { light: 0, CO2: 0.5 }, cfg);
  assertNear(gate, 0);
});

test("predator without prey reduces F via stress", () => {
  const d = decodeSequence(buildExpressionHeader(2, 2, 0, 0));
  const envGate = computeEnvGate(d, { O2: 0.3, DOC: 0.2 }, cfg);
  const E = computeExpressionStrength(0.6, 1, envGate, false, cfg);
  const withPrey = computeFlux(d, E, 1, cfg, { hasPrey: true });
  const noPrey = computeFlux(d, E, 1, cfg, { hasPrey: false });
  assertTrue(noPrey.F < withPrey.F);
});

test("predator transfer capped at 10% biomass", () => {
  const transfer = computePredatorTransfer(1, 0.5, cfg);
  assertNear(transfer, 0.05);
  const capped = computePredatorTransfer(10, 0.3, cfg);
  assertNear(capped, 0.03);
});

test("phenotypic diff shifts effective archetype", () => {
  const seq = buildExpressionHeader(0, 4, 8, 0);
  const d = decodeSequence(seq);
  assertTrue(d.allowsPhenotypicDiff);
  const eff = computeEffectivePhenotype(d, {
    localDOC: 0.8,
    meanDOC: 0.2,
    localLight: 0.9,
    meanLight: 0.3,
  });
  assertEqual(eff.effectiveArchetype, "anaerobe_decomposer");
});

test("redundant storage bonus on expression", () => {
  const d = decodeSequence(buildExpressionHeader(0, 0, 0, 0));
  const gate = computeEnvGate(d, { light: 1, CO2: 0.4 }, cfg);
  const plain = computeExpressionStrength(0.5, 1, gate, false, cfg);
  const bonus = computeExpressionStrength(0.5, 1, gate, true, cfg);
  assertNear(bonus / plain, cfg.redundantExpressionBonus);
});

test("netOrganicCarbonGain producer positive", () => {
  const d = decodeSequence(buildExpressionHeader(0, 0, 0, 0));
  const gate = computeEnvGate(d, { light: 1, CO2: 0.5 }, cfg);
  const E = computeExpressionStrength(0.9, 1, gate, false, cfg);
  const flux = computeFlux(d, E, 1, cfg);
  assertTrue(netOrganicCarbonGain(flux) > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
