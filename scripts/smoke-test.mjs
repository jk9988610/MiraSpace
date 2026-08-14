#!/usr/bin/env node
/**
 * Smoke tier: stage0 15 sim s + stage2/3 45 sim s, seed=42. AI default after code changes.
 * Run: node scripts/smoke-test.mjs
 */
import { loadPresetSync } from "./preset-loader.mjs";
import { runSimSeconds, timed } from "./test-utils.mjs";
import { buildReport } from "./test-report.mjs";

const SEED = 42;
const SIM_BY_STAGE = { stage0: 15, stage2: 45, stage3: 45 };

/**
 * @param {{ preset?: string }} [opts]
 */
export function runSmoke(opts = {}) {
  const presets = {
    stage0: loadPresetSync("stage0-default"),
    stage2: loadPresetSync("stage2-default"),
    stage3: loadPresetSync("stage3-default"),
  };

  const filter = opts.preset?.replace(/\.json$/, "");
  const entries = Object.entries(presets).filter(([key]) => {
    if (!filter || filter === "all") return true;
    if (filter === "stage0-default") return key === "stage0";
    if (filter === "stage2-default") return key === "stage2";
    if (filter === "stage3-default") return key === "stage3";
    return key === filter.replace("-default", "");
  });

  const { result, wallMs } = timed(() => {
    const checks = [];
    const metrics = {};

    for (const [stageKey, preset] of entries) {
      const simSeconds = SIM_BY_STAGE[stageKey] ?? 15;
      const w = runSimSeconds(preset, SEED, simSeconds);

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
    }

    return { checks, metrics };
  });

  const checks = [
    ...result.checks,
    { id: "wallClockUnder5s", pass: wallMs <= 5000 },
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

const isMain = process.argv[1]?.includes("smoke-test.mjs");
if (isMain) {
  const { printReport } = await import("./test-report.mjs");
  const json = process.argv.includes("--json");
  const presetArg = process.argv.find((a) => a.startsWith("--preset="));
  const report = runSmoke({ preset: presetArg?.split("=")[1] });
  printReport(report, { json });
  process.exit(report.allPass ? 0 : 1);
}
