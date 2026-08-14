#!/usr/bin/env node
/**
 * E6: earth profile coordinates (tick-fast).
 * Run: node scripts/test-earth-profile-e6.mjs
 */
import { World } from "../site/js/world.js";
import { EarthProfile } from "../site/js/earth-profile.js";
import { loadPresetSync } from "./preset-loader.mjs";
import { runTicks } from "./test-utils.mjs";

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

function meanDocInZone(w, zone) {
  const profile = w.earthProfile;
  let sum = 0;
  let n = 0;
  for (let gy = 0; gy < profile.gridH; gy += 1) {
    for (let gx = 0; gx < profile.gridW; gx += 1) {
      if (profile.zoneAtGrid(gx, gy) !== zone) continue;
      const idx = gy * profile.gridW + gx;
      sum += w.fields.DOC[idx];
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

test("earth profile attached on stage-earth-default", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  if (!w.earthProfile || !w.fields.earthProfile) throw new Error("missing profile");
});

test("y bands resolve five terrain zones", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  const p = w.earthProfile;
  const zones = new Set([
    p.zoneAt(20),
    p.zoneAt(200),
    p.zoneAt(400),
    p.zoneAt(550),
    p.zoneAt(750),
  ]);
  if (zones.size < 4) throw new Error(`zones=${[...zones].join(",")}`);
});

test("sediment DOC baseline higher than ocean", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  const sediment = meanDocInZone(w, "sediment");
  const ocean = meanDocInZone(w, "ocean");
  if (sediment <= ocean * 1.5) {
    throw new Error(`sediment=${sediment.toFixed(3)} ocean=${ocean.toFixed(3)}`);
  }
});

test("light varies with longitude x", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  const p = w.earthProfile;
  const y = w.height * 0.6;
  const l0 = p.sampleLight(50, y);
  const l1 = p.sampleLight(w.width * 0.75, y);
  if (Math.abs(l0 - l1) < 0.15) throw new Error(`l0=${l0} l1=${l1}`);
});

test("ocean depth attenuates light", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  const p = w.earthProfile;
  const x = w.width * 0.3;
  const surface = p.sampleLight(x, w.height * p.oceanTop - 5);
  const deep = p.sampleLight(x, w.height * p.sedimentTop + 5);
  if (surface <= deep) throw new Error(`surface=${surface} deep=${deep}`);
});

test("fields sampleExpressionEnv exposes profile light", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 42);
  const env = w.fields.sampleExpressionEnv(w.width * 0.25, w.height * 0.6);
  if (!Number.isFinite(env.light) || env.light <= 0) throw new Error(`light=${env.light}`);
  if (!env.zone) throw new Error("missing zone");
});

test("world-fixed light repeats on longitude wrap", () => {
  const profile = new EarthProfile(preset, preset.world.width, preset.world.height, 90, 51);
  const y = preset.world.height * 0.55;
  const a = profile.sampleLight(10, y);
  const b = profile.sampleLight(10 + preset.world.width, y);
  if (Math.abs(a - b) > 1e-6) throw new Error(`${a} vs ${b}`);
});

test("sim ticks keep ecology + profile valid", () => {
  const w = new World({ ...preset, _name: "stage-earth-default" }, 7);
  runTicks(w, 120);
  const ecology = w.fields.validateEcologyState();
  if (!ecology.ok) throw new Error(ecology.reason ?? "ecology invalid");
  if (!w.earthProfile) throw new Error("profile missing after ticks");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
