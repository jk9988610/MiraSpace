/**
 * Unified Markdown test report (Talk 测试分层规范).
 */

/**
 * @param {object} opts
 * @param {"smoke"|"acceptance"|"quick"} opts.suite
 * @param {string} [opts.preset]
 * @param {number[]} [opts.seeds]
 * @param {number} [opts.simSeconds]
 * @param {number} opts.wallMs
 * @param {{ id: string, pass: boolean, skipped?: boolean }[]} opts.checks
 * @param {Record<string, string|number|boolean>} [opts.metrics]
 * @param {boolean} opts.allPass
 */
export function buildReport(opts) {
  return {
    runAt: new Date().toISOString(),
    suite: opts.suite,
    preset: opts.preset ?? "all",
    seeds: opts.seeds ?? [42],
    simSeconds: opts.simSeconds ?? null,
    wallMs: opts.wallMs,
    allPass: opts.allPass,
    checks: opts.checks,
    metrics: opts.metrics ?? {},
  };
}

/** @param {ReturnType<typeof buildReport>} report */
export function formatMarkdown(report) {
  const seedStr = report.seeds.join(", ");
  const simLine = report.simSeconds != null
    ? `- simSeconds: ${report.simSeconds}\n`
    : "";

  const rows = report.checks.map((c) => {
    const status = c.skipped ? "skipped" : (c.pass ? "yes" : "no");
    return `| ${c.id} | ${status} |`;
  }).join("\n");

  const metricLines = Object.entries(report.metrics)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return [
    "## MiraSpace Test Report",
    `- runAt: ${report.runAt}`,
    `- suite: ${report.suite}`,
    `- preset: ${report.preset}`,
    `- seeds: ${seedStr}`,
    simLine + `- wallMs: ${report.wallMs}`,
    `- allPass: ${report.allPass ? "yes" : "no"}`,
    "",
    "### Results",
    "| check | pass |",
    "|-------|------|",
    rows,
    "",
    "### Metrics (final)",
    metricLines || "_none_",
    "",
  ].join("\n");
}

/**
 * @param {ReturnType<typeof buildReport>} report
 * @param {{ json?: boolean }} [opts]
 */
export function printReport(report, opts = {}) {
  console.log(formatMarkdown(report));
  if (opts.json) {
    console.log("\n<!-- JSON -->\n" + JSON.stringify(report, null, 2));
  }
}
