import { STAGE_TABS } from "./stage-nav.js";

/**
 * @param {{
 *   presetName: string,
 *   stageLabel: string,
 *   seed: number,
 *   simTime: number,
 *   tickCount: number,
 *   timeScale: number,
 *   paused: boolean,
 *   metrics: object,
 *   world: import('./world.js').World,
 * }} ctx
 */
export function buildDataRecord(ctx) {
  const lines = [];
  const w = ctx.world;
  const m = ctx.metrics;

  lines.push("MiraSpace 数据记录");
  lines.push(`导出时间: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("── 运行状态 ──");
  lines.push(`阶段 Tab: ${ctx.stageLabel}`);
  lines.push(`Preset: ${ctx.presetName}`);
  lines.push(`Seed: ${ctx.seed}`);
  lines.push(`Sim 时间: ${ctx.simTime.toFixed(2)} s`);
  lines.push(`Tick: ${ctx.tickCount}`);
  lines.push(`时间倍率: ${ctx.timeScale}×`);
  lines.push(`暂停: ${ctx.paused ? "是" : "否"}`);
  lines.push(`粒子数: ${w.particles.count()}`);
  if (w.replicator) lines.push(`Strand 数: ${w.replicator.count()}`);
  if (w.vesicle) lines.push(`Vesicle 数: ${w.vesicle.count()}`);
  if (w.colony) lines.push(`Colony 数: ${w.colony.count()}`);

  lines.push("");
  lines.push("── S1 指标 ──");
  lines.push(`clusterIndex: ${m.clusterIndex?.toFixed(4)} (avg ${m.clusterAvg?.toFixed(4)})`);
  lines.push(`autocatalyticScore: ${m.autocatalyticScore?.toFixed(4)} (avg ${m.autocatalyticAvg?.toFixed(4)})`);
  lines.push(`negentropyFlux: ${m.negentropyFlux?.toFixed(4)} (avg ${m.negentropyAvg?.toFixed(4)})`);

  if (w.replicator) {
    lines.push("");
    lines.push("── S2 指标 ──");
    lines.push(`heritability: ${m.heritability?.toFixed(4)} (avg ${m.heritabilityAvg?.toFixed(4)})`);
    lines.push(`selectiveSweep: ${m.selectiveSweep?.toFixed(4)} (avg ${m.selectiveSweepAvg?.toFixed(4)})`);
    lines.push(`informationAccumulation: ${m.informationAccumulation?.toFixed(4)} (avg ${m.informationAccumulationAvg?.toFixed(4)})`);
    lines.push(`parasiteFraction: ${m.parasiteFraction?.toFixed(4)}`);
    lines.push(`strandCount: ${m.strandCount ?? 0}`);
  }

  if (w.vesicle) {
    lines.push("");
    lines.push("── S3 指标 ──");
    lines.push(`encapsulationGain: ${(m.encapsulationGain ?? 0).toFixed(4)} (avg ${(m.encapsulationGainAvg ?? 0).toFixed(4)})`);
    lines.push(`parasiteLoad: ${(m.parasiteLoad ?? 0).toFixed(4)} (avg ${(m.parasiteLoadAvg ?? 0).toFixed(4)})`);
    lines.push(`fissionEvents: ${m.fissionEvents ?? 0}`);
    lines.push(`vesicleCount: ${m.vesicleCount ?? 0}`);
  }

  if (w.chemoton) {
    lines.push("");
    lines.push("── S4 指标 ──");
    lines.push(`chemotonCoherence: ${(m.chemotonCoherence ?? 0).toFixed(4)} (avg ${(m.chemotonCoherenceAvg ?? 0).toFixed(4)})`);
    lines.push(`lineagePersistence: ${(m.lineagePersistence ?? 0).toFixed(4)} (avg ${(m.lineagePersistenceAvg ?? 0).toFixed(4)})`);
    lines.push(`storageFidelity: ${(m.storageFidelity ?? 1).toFixed(4)}`);
    lines.push(`chemotonCount: ${m.chemotonCount ?? 0}`);
  }

  if (w.colony) {
    lines.push("");
    lines.push("── S5 指标 ──");
    lines.push(`multicellularPersistence: ${(m.multicellularPersistence ?? 0).toFixed(4)} (avg ${(m.multicellularPersistenceAvg ?? 0).toFixed(4)})`);
    lines.push(`divisionOfLabor: ${(m.divisionOfLabor ?? 0).toFixed(4)} (avg ${(m.divisionOfLaborAvg ?? 0).toFixed(4)})`);
    lines.push(`developmentalPattern: ${(m.developmentalPattern ?? 0).toFixed(4)} (avg ${(m.developmentalPatternAvg ?? 0).toFixed(4)})`);
    lines.push(`colonyCount: ${m.colonyCount ?? 0}`);
  }

  lines.push("");
  lines.push("── 全部阶段 Tab 映射 ──");
  for (const tab of STAGE_TABS) {
    lines.push(`${tab.label} → ${tab.preset} (${tab.subtitle})`);
  }

  return lines.join("\n");
}

/**
 * @param {Parameters<typeof buildDataRecord>[0]} ctx
 */
export function printDataRecord(ctx) {
  const text = buildDataRecord(ctx);
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>MiraSpace 数据记录</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;line-height:1.5;white-space:pre-wrap;font-size:13px;color:#111}</style></head>
<body>${text.replace(/</g, "&lt;")}</body></html>`;

  const win = window.open("", "_blank", "width=720,height=640");
  if (!win) {
    console.log(text);
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
