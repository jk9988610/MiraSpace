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
export function buildSnapshotNarrative(ctx) {
  const w = ctx.world;
  const m = ctx.metrics;
  const paragraphs = [];

  paragraphs.push(
    `此刻处于「${ctx.stageLabel}」（${ctx.presetName}），`
    + `seed=${ctx.seed}，模拟时间 ${ctx.simTime.toFixed(1)} s（tick ${ctx.tickCount}），`
    + `时间倍率 ${ctx.timeScale}×，${ctx.paused ? "已暂停" : "运行中"}。`,
  );

  paragraphs.push(
    `场上有 ${w.particles.count()} 个粒子（monomer/catalyst/dimer）。`
    + ` S1 指标：clusterIndex ${m.clusterIndex?.toFixed(2)}、`
    + `autocatalytic ${m.autocatalyticScore?.toFixed(2)}、`
    + `negentropy ${m.negentropyFlux?.toFixed(2)}。`,
  );

  if (w.replicator) {
    paragraphs.push(
      `S2：strand ${m.strandCount ?? w.replicator.count()} 条；`
      + `heritability ${m.heritability?.toFixed(2)}，`
      + `informationAccumulation ${m.informationAccumulation?.toFixed(2)}，`
      + `parasiteFraction ${m.parasiteFraction?.toFixed(2)}。`,
    );
  }

  if (w.vesicle) {
    paragraphs.push(
      `S3：vesicle ${m.vesicleCount ?? w.vesicle.count()} 个；`
      + `encapsulationGain ${(m.encapsulationGain ?? 0).toFixed(2)}，`
      + `fissionEvents（300s 窗）${m.fissionEvents ?? 0}。`,
    );
  }

  if (w.chemoton) {
    paragraphs.push(
      `S4：chemotonCoherence ${(m.chemotonCoherence ?? 0).toFixed(2)}，`
      + `lineagePersistence ${(m.lineagePersistence ?? 0).toFixed(2)}，`
      + `coherent vesicle ${m.chemotonCount ?? 0} 个。`,
    );
  }

  if (w.colony) {
    paragraphs.push(
      `S5：colony ${m.colonyCount ?? w.colony.count()} 个；`
      + `multicellularPersistence ${(m.multicellularPersistence ?? 0).toFixed(2)}，`
      + `divisionOfLabor ${(m.divisionOfLabor ?? 0).toFixed(2)}。`,
    );
  }

  if (w.fields?.ecologyEnabled && w.colony && w.vesicle) {
    const phenoLines = [];
    for (const colony of w.colony.list) {
      if (colony.memberVesicleIds.length < 2) continue;
      const members = colony.memberVesicleIds.map((id) => {
        const v = w.vesicle.byId(id);
        if (!v?.chemoton) return null;
        return {
          vesicleId: id,
          genotypeArchetype: v.chemoton.genotypeArchetype ?? v.chemoton.archetype,
          effectiveArchetype: v.chemoton.effectiveArchetype ?? v.chemoton.archetype,
          effectiveM: v.chemoton.effectiveM,
          effectiveT: v.chemoton.effectiveT,
        };
      }).filter(Boolean);
      if (members.length > 0) {
        phenoLines.push(`群体 ${colony.id}：${members.map((mem) => `${mem.effectiveArchetype}`).join("、")}`);
      }
    }
    if (phenoLines.length > 0) {
      paragraphs.push(`E5 表观分工：${phenoLines.join("；")}。`);
    }
  }

  return paragraphs.join("\n\n");
}

/**
 * @param {Parameters<typeof buildSnapshotNarrative>[0]} ctx
 */
export function buildSnapshotText(ctx) {
  const narrative = buildSnapshotNarrative(ctx);
  const w = ctx.world;
  const m = ctx.metrics;

  const lines = [
    "MiraSpace 快照",
    `导出: ${new Date().toISOString()}`,
    "",
    "── 情况说明 ──",
    narrative,
    "",
    "── 原始数据 ──",
    `preset: ${ctx.presetName}`,
    `seed: ${ctx.seed}`,
    `simTime: ${ctx.simTime.toFixed(4)} s`,
    `tick: ${ctx.tickCount}`,
    `timeScale: ${ctx.timeScale}`,
    `particles: ${w.particles.count()}`,
  ];

  if (w.replicator) lines.push(`strands: ${w.replicator.count()}`);
  if (w.vesicle) lines.push(`vesicles: ${w.vesicle.count()}`);
  if (w.colony) lines.push(`colonies: ${w.colony.count()}`);

  lines.push("", "── S1 ──");
  lines.push(`clusterIndex: ${m.clusterIndex} (avg ${m.clusterAvg})`);
  lines.push(`autocatalyticScore: ${m.autocatalyticScore} (avg ${m.autocatalyticAvg})`);
  lines.push(`negentropyFlux: ${m.negentropyFlux} (avg ${m.negentropyAvg})`);

  if (w.replicator) {
    lines.push("", "── S2 ──");
    lines.push(`heritability: ${m.heritability} (avg ${m.heritabilityAvg})`);
    lines.push(`selectiveSweep: ${m.selectiveSweep} (avg ${m.selectiveSweepAvg})`);
    lines.push(`informationAccumulation: ${m.informationAccumulation} (avg ${m.informationAccumulationAvg})`);
    lines.push(`parasiteFraction: ${m.parasiteFraction}`);
  }

  if (w.vesicle) {
    lines.push("", "── S3 ──");
    lines.push(`encapsulationGain: ${m.encapsulationGain} (avg ${m.encapsulationGainAvg})`);
    lines.push(`parasiteLoad: ${m.parasiteLoad} (avg ${m.parasiteLoadAvg})`);
    lines.push(`fissionEvents: ${m.fissionEvents}`);
    lines.push(`vesicleCount: ${m.vesicleCount}`);
  }

  if (w.chemoton) {
    lines.push("", "── S4 ──");
    lines.push(`chemotonCoherence: ${m.chemotonCoherence} (avg ${m.chemotonCoherenceAvg})`);
    lines.push(`lineagePersistence: ${m.lineagePersistence} (avg ${m.lineagePersistenceAvg})`);
    lines.push(`storageFidelity: ${m.storageFidelity}`);
    lines.push(`chemotonCount: ${m.chemotonCount}`);
  }

  if (w.colony) {
    lines.push("", "── S5 ──");
    lines.push(`multicellularPersistence: ${m.multicellularPersistence} (avg ${m.multicellularPersistenceAvg})`);
    lines.push(`divisionOfLabor: ${m.divisionOfLabor} (avg ${m.divisionOfLaborAvg})`);
    lines.push(`developmentalPattern: ${m.developmentalPattern} (avg ${m.developmentalPatternAvg})`);
    lines.push(`colonyCount: ${m.colonyCount}`);
  }

  if (w.fields?.ecologyEnabled && w.colony && w.vesicle) {
    lines.push("", "── E5 phenotypic ──");
    lines.push(`phenotypicArchetypeRichness: ${m.phenotypicArchetypeRichness ?? 0}`);
    for (const colony of w.colony.list) {
      if (colony.memberVesicleIds.length < 2) continue;
      for (const id of colony.memberVesicleIds) {
        const v = w.vesicle.byId(id);
        if (!v?.chemoton) continue;
        lines.push(
          `${colony.id}/${id}: genotype=${v.chemoton.genotypeArchetype ?? v.chemoton.archetype}`
          + ` effectiveArchetype=${v.chemoton.effectiveArchetype ?? v.chemoton.archetype}`
          + ` effectiveM=${v.chemoton.effectiveM ?? "—"} effectiveT=${v.chemoton.effectiveT ?? "—"}`,
        );
      }
    }
  }

  lines.push("", "── 阶段 Tab ──");
  for (const tab of STAGE_TABS) {
    lines.push(`${tab.label}: ${tab.preset}`);
  }

  return lines.join("\n");
}
