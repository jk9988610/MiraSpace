#!/usr/bin/env node
/**
 * Unified test entry: smoke (AI default) or acceptance (CI / maintainer).
 *
 *   node scripts/run-suite.mjs --smoke
 *   node scripts/run-suite.mjs --acceptance
 *   node scripts/run-suite.mjs --acceptance --preset=stage3-default
 *   node scripts/run-suite.mjs --smoke --json
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSmoke } from "./smoke-test.mjs";
import { buildReport, formatMarkdown, printReport } from "./test-report.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = __dirname;

function parseArgs(argv) {
  const smoke = argv.includes("--smoke");
  const acceptance = argv.includes("--acceptance");
  const json = argv.includes("--json");
  const presetArg = argv.find((a) => a.startsWith("--preset="));
  const preset = presetArg?.split("=")[1]?.replace(/\.json$/, "");
  return { smoke, acceptance, json, preset };
}

function usage() {
  console.error(`Usage:
  node scripts/run-suite.mjs --smoke [--preset=stage3-default] [--json]
  node scripts/run-suite.mjs --acceptance [--preset=stage0-default|stage2-default|stage3-default|stage4-default] [--json]

AI default: --smoke only. Do not run --acceptance unless explicitly requested.`);
}

/**
 * @param {string} script
 * @param {string[]} extraArgs
 */
function runScript(script, extraArgs = []) {
  const t0 = performance.now();
  const proc = spawnSync(process.execPath, [join(SCRIPTS, script), ...extraArgs], {
    encoding: "utf8",
    cwd: join(SCRIPTS, ".."),
  });
  return {
    script,
    exitCode: proc.status ?? 1,
    wallMs: Math.round(performance.now() - t0),
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
  };
}

/**
 * @param {{ preset?: string }} opts
 */
function runAcceptance(opts = {}) {
  const t0 = performance.now();
  const stages = [
    { id: "s1", script: "s1-headless-test.mjs", presets: ["stage0-default", "stage0"] },
    { id: "s2", script: "s2-headless-test.mjs", presets: ["stage2-default", "stage2"] },
    { id: "s3", script: "s3-headless-test.mjs", presets: ["stage3-default", "stage3"] },
    { id: "s4", script: "s4-headless-test.mjs", presets: ["stage4-default", "stage4"] },
  ];

  const filter = opts.preset?.replace(/\.json$/, "");
  const selected = stages.filter((s) => {
    if (!filter) return true;
    return s.presets.some((p) => p === filter || p === filter.replace("-default", ""));
  });

  const runs = selected.map((stage) => runScript(stage.script, ["--acceptance"]));
  const checks = [];

  for (const stage of stages) {
    const run = runs.find((r) => r.script === stage.script);
    if (run) {
      checks.push({
        id: stage.script.replace(".mjs", ""),
        pass: run.exitCode === 0,
      });
    } else {
      checks.push({
        id: stage.script.replace(".mjs", ""),
        pass: true,
        skipped: true,
      });
    }
  }

  const metrics = {};
  for (const r of runs) {
    try {
      const json = JSON.parse(r.stdout);
      if (json.allPass != null) metrics[r.script] = json.allPass ? "pass" : "fail";
    } catch {
      metrics[r.script] = r.exitCode === 0 ? "pass" : "fail";
    }
  }

  const wallMs = Math.round(performance.now() - t0);
  const allPass = runs.every((r) => r.exitCode === 0);

  return {
    report: buildReport({
      suite: "acceptance",
      preset: filter ?? "all",
      seeds: [42, 7, 99],
      simSeconds: 600,
      wallMs,
      checks,
      metrics,
      allPass,
    }),
    runs,
  };
}

const args = parseArgs(process.argv.slice(2));

if (!args.smoke && !args.acceptance) {
  usage();
  process.exit(2);
}

if (args.smoke && args.acceptance) {
  console.error("Specify --smoke or --acceptance, not both.");
  process.exit(2);
}

if (args.smoke) {
  const report = runSmoke({ preset: args.preset });
  printReport(report, { json: args.json });
  process.exit(report.allPass ? 0 : 1);
}

const { report, runs } = runAcceptance({ preset: args.preset });
printReport(report, { json: args.json });

if (!args.json) {
  console.log("\n### Acceptance logs (tail)\n");
  for (const r of runs) {
    const tail = (r.stdout || r.stderr).trim().split("\n").slice(-3).join("\n");
    console.log(`**${r.script}** (exit ${r.exitCode}, ${r.wallMs}ms)\n\`\`\`\n${tail}\n\`\`\`\n`);
  }
}

process.exit(report.allPass ? 0 : 1);
