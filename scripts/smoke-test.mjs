#!/usr/bin/env node
/**
 * Smoke tier: stage0 15 sim s + stage2/3 45 sim s, seed=42. AI default after code changes.
 * Run: node scripts/smoke-test.mjs
 */
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds, runSimTicks, timed } from "./test-utils.mjs";
import { buildReport } from "./test-report.mjs";
import {
  carbonBudgetWithinTolerance,
  estimateCarbonPool,
} from "../site/js/gene-flux.js";
import { World } from "../site/js/world.js";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SEED = 42;
const SIM_BY_STAGE = { stage0: 15, stage2: 45, stage3: 45, stage4: 45, stage5: 45, stageEarth: 45 };
const EARTH_SMOKE_TICKS = 1350;
const SMOKE_WALL_MS = 12000;

/**
 * @param {{ preset?: string }} [opts]
 */
export function runSmoke(opts = {}) {
  const presets = {
    stage0: loadPresetSync("stage0-default"),
    stage2: loadPresetSync("stage2-default"),
    stage3: loadPresetSync("stage3-default"),
    stage4: loadPresetSync("stage4-default"),
    stage5: loadPresetSync("stage5-default"),
    stageEarth: loadPresetSync("stage-earth-default"),
  };

  const filter = opts.preset?.replace(/\.json$/, "");
  const entries = Object.entries(presets).filter(([key]) => {
    if (!filter || filter === "all") return true;
    if (filter === "stage0-default") return key === "stage0";
    if (filter === "stage2-default") return key === "stage2";
    if (filter === "stage3-default") return key === "stage3";
    if (filter === "stage4-default") return key === "stage4";
    if (filter === "stage5-default") return key === "stage5";
    if (filter === "stage-earth-default") return key === "stageEarth";
    return key === filter.replace("-default", "");
  });

  const { result, wallMs } = timed(() => {
    const checks = [];
    const metrics = {};

    for (const [stageKey, preset] of entries) {
      const simSeconds = SIM_BY_STAGE[stageKey] ?? 15;
      let carbonBefore = null;
      let o2Start = null;
      if (stageKey === "stageEarth") {
        const w0 = new World({ ...preset, _name: "stage-earth-default" }, SEED);
        carbonBefore = estimateCarbonPool(w0.fields, w0.vesicle);
        o2Start = w0.fields.globalO2;
      }
      const w = stageKey === "stageEarth"
        ? runSimTicks(preset, SEED, EARTH_SMOKE_TICKS)
        : runSimSeconds(preset, SEED, simSeconds);

      if (stageKey === "stage0") {
        const pass = w.tickCount > 0 && w.particles.count() > 0;
        checks.push({ id: "tickAdvances", pass });
        checks.push({ id: "particlesExist", pass });
        metrics.particles = w.particles.count();
        metrics.clusterIndex = Number(w.metrics.clusterIndex.toFixed(2));
      }

      if (stageKey === "stage2") {
        const strands = w.replicator?.count() ?? 0;
        const replicated = w.replicator?.list.some((s) => s.replicationSuccesses > 0) ?? false;
        const pass = strands > 0 || replicated;
        checks.push({ id: "strandNucleationOrReplication", pass });
        metrics.strandCount = strands;
      }

      if (stageKey === "stage3") {
        const vesicles = w.vesicle?.count() ?? 0;
        const interior = w.vesicle?.interiorStrandCount(w.replicator) ?? 0;
        const pass = vesicles > 0 || interior > 0;
        checks.push({ id: "vesicleNucleationOrCapture", pass });
        metrics.vesicleCount = vesicles;
        metrics.interiorStrands = interior;
      }

      if (stageKey === "stage4") {
        const vesicles = w.vesicle?.count() ?? 0;
        const hasChemoton = w.vesicle?.list.some((v) => v.chemoton) ?? false;
        const pass = vesicles > 0 && hasChemoton;
        checks.push({ id: "chemotonActive", pass });
        checks.push({
          id: "fissionFitnessGate",
          pass: testFissionFitnessGate(w),
        });
        metrics.chemotonCoherence = Number((w.metrics.chemotonCoherence ?? 0).toFixed(3));
        metrics.vesicleCount = vesicles;
      }

      if (stageKey === "stage5") {
        const hasColony = w.colony != null;
        checks.push({ id: "colonyModuleActive", pass: hasColony });
        checks.push({
          id: "colonyLinkOrRegistry",
          pass: hasColony && testColonyLinkOnFission(w),
        });
        checks.push({
          id: "s5MetricsRecorded",
          pass: w.metrics.multicellularPersistence >= 0
            && w.metrics.divisionOfLabor >= 0
            && w.metrics.developmentalPattern >= 0,
        });
        metrics.colonyCount = w.metrics.colonyCount ?? 0;
        metrics.divisionOfLabor = Number((w.metrics.divisionOfLabor ?? 0).toFixed(3));
      }

      if (stageKey === "stageEarth") {
        const ecology = w.fields.validateEcologyState();
        checks.push({ id: "ecologyFieldsBounded", pass: ecology.ok });
        checks.push({ id: "ecologyChannelsPresent", pass: w.fields.ecologyEnabled && w.fields.CO2 && w.fields.O2 });
        const carbonAfter = estimateCarbonPool(w.fields, w.vesicle);
        checks.push({
          id: "carbonBudgetTolerance",
          pass: carbonBefore != null && carbonBudgetWithinTolerance(carbonBefore, carbonAfter, 0.2),
        });
        checks.push({
          id: "geneFluxCouplingActive",
          pass: (w.chemoton?.geneFluxTicks ?? 0) > 0,
        });
        metrics.globalO2 = Number(w.fields.globalO2.toFixed(4));
        metrics.globalCO2 = Number(w.fields.globalCO2.toFixed(4));
        metrics.meanCO2 = Number(w.fields._fieldMean(w.fields.CO2).toFixed(4));
        metrics.geneFluxTicks = w.chemoton?.geneFluxTicks ?? 0;
        metrics.globalO2Delta = Number((w.fields.globalO2 - (o2Start ?? w.fields.globalO2)).toFixed(6));
      }
    }

    return { checks, metrics };
  });

  const geneProc = spawnSync(process.execPath, [join(__dirname, "test-gene-expression.mjs")], {
    encoding: "utf8",
    cwd: join(__dirname, ".."),
  });
  const fluxProc = spawnSync(process.execPath, [join(__dirname, "test-gene-flux.mjs")], {
    encoding: "utf8",
    cwd: join(__dirname, ".."),
  });
  const phenoProc = spawnSync(process.execPath, [join(__dirname, "test-phenotype-e5.mjs")], {
    encoding: "utf8",
    cwd: join(__dirname, ".."),
  });
  const profileProc = spawnSync(process.execPath, [join(__dirname, "test-earth-profile-e6.mjs")], {
    encoding: "utf8",
    cwd: join(__dirname, ".."),
  });

  const checks = [
    ...result.checks,
    { id: "geneExpressionDecode", pass: (geneProc.status ?? 1) === 0 },
    { id: "geneFluxCoupling", pass: (fluxProc.status ?? 1) === 0 },
    { id: "phenotypicDifferentiation", pass: (phenoProc.status ?? 1) === 0 },
    { id: "earthProfileCoordinates", pass: (profileProc.status ?? 1) === 0 },
    { id: "wallClockUnder12s", pass: wallMs <= SMOKE_WALL_MS },
  ];
  const allPass = checks.every((c) => c.pass);

  return buildReport({
    suite: "smoke",
    preset: filter ?? "all",
    seeds: [SEED],
    simSeconds: Math.max(...Object.values(SIM_BY_STAGE)),
    wallMs,
    checks,
    metrics: result.metrics,
    allPass,
  });
}

/** @param {import('../site/js/world.js').World} world */
function testColonyLinkOnFission(world) {
  if (!world.colony || !world.vesicle) return false;
  const parent = { id: "smoke-parent", lineageId: 1, age: 50, colonyId: null, links: [] };
  const childA = { id: "smoke-a", lineageId: 1, age: 0, colonyId: null, links: [] };
  const childB = { id: "smoke-b", lineageId: 1, age: 0, colonyId: null, links: [] };
  world.colony.onFission(parent, childA, childB, world.vesicle);
  return childA.links.length > 0
    && childB.links.length > 0
    && childA.colonyId != null
    && childA.colonyId === childB.colonyId
    && world.colony.count() > 0;
}

/** @param {import('../site/js/world.js').World} world */
function testFissionFitnessGate(world) {
  if (!world.chemoton) return true;
  const threshold = (world.preset.vesicle.fissionThresholdRatio ?? 0.62)
    * world.preset.vesicle.radiusMax;
  const low = {
    radius: threshold + 1,
    chemoton: {
      metabolicFlux: 0.1,
      membraneHealth: 0.1,
      geneticActivity: 0.1,
      coherenceTicks: 0,
    },
  };
  const high = {
    radius: threshold + 1,
    chemoton: {
      metabolicFlux: 0.8,
      membraneHealth: 0.8,
      geneticActivity: 0.8,
      coherenceTicks: 200,
    },
  };
  return !world.chemoton.canFission(low, threshold)
    && world.chemoton.canFission(high, threshold);
}

const isMain = process.argv[1]?.includes("smoke-test.mjs");
if (isMain) {
  const { printReport } = await import("./test-report.mjs");
  const json = process.argv.includes("--json");
  const presetArg = process.argv.find((a) => a.startsWith("--preset="));
  const report = runSmoke({ preset: presetArg?.split("=")[1] });
  printReport(report, { json });
  process.exit(report.allPass ? 0 : 1);
}
