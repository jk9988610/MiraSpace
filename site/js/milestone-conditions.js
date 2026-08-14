/**
 * Milestone condition definitions shared by tracker and tech-tree UI.
 */

import { METRICS, STAGES } from "./biology-names.js";

/** @typedef {'>=' | '<='} CompareOp */

/**
 * @typedef {{
 *   id: string,
 *   stage: string,
 *   stageKey: string,
 *   label: string,
 *   metricKey: string,
 *   getThreshold: (preset: object) => number | null | undefined,
 *   compare: CompareOp,
 *   windowLabel: string,
 * }} ConditionDef
 */

/** @type {ConditionDef[]} */
export const MILESTONE_CONDITIONS = [
  {
    id: "s1-cluster",
    stage: STAGES.s1.zh,
    stageKey: "s1",
    label: METRICS.clusterIndex.zh,
    metricKey: "clusterAvg",
    getThreshold: (p) => p.metricsThresholds?.clusterIndex,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s1-autocat",
    stage: STAGES.s1.zh,
    stageKey: "s1",
    label: METRICS.autocatalyticScore.zh,
    metricKey: "autocatalyticAvg",
    getThreshold: (p) => p.metricsThresholds?.autocatalyticScore,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s1-negentropy",
    stage: STAGES.s1.zh,
    stageKey: "s1",
    label: METRICS.negentropyFlux.zh,
    metricKey: "negentropyAvg",
    getThreshold: (p) => p.metricsThresholds?.negentropyFluxRatio,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s2-heritability",
    stage: STAGES.s2.zh,
    stageKey: "s2",
    label: METRICS.heritability.zh,
    metricKey: "heritabilityAvg",
    getThreshold: (p) => p.metricsThresholdsS2?.heritability,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s2-sweep",
    stage: STAGES.s2.zh,
    stageKey: "s2",
    label: METRICS.selectiveSweep.zh,
    metricKey: "selectiveSweepAvg",
    getThreshold: (p) => p.metricsThresholdsS2?.selectiveSweepTopShare,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s2-info",
    stage: STAGES.s2.zh,
    stageKey: "s2",
    label: METRICS.informationAccumulation.zh,
    metricKey: "informationAccumulationAvg",
    getThreshold: (p) => p.metricsThresholdsS2?.informationAccumulationRatio,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s3-encap",
    stage: STAGES.s3.zh,
    stageKey: "s3",
    label: METRICS.encapsulationGain.zh,
    metricKey: "encapsulationGainAvg",
    getThreshold: (p) => p.metricsThresholdsS3?.encapsulationGain,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s3-fission",
    stage: STAGES.s3.zh,
    stageKey: "s3",
    label: METRICS.fissionEvents.zh,
    metricKey: "fissionEvents",
    getThreshold: (p) => p.metricsThresholdsS3?.fissionEventsPer300s,
    compare: ">=",
    windowLabel: "300 s 窗",
  },
  {
    id: "s4-coherence",
    stage: STAGES.s4.zh,
    stageKey: "s4",
    label: METRICS.chemotonCoherence.zh,
    metricKey: "chemotonCoherenceAvg",
    getThreshold: (p) => p.metricsThresholdsS4?.chemotonCoherence,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s4-lineage",
    stage: STAGES.s4.zh,
    stageKey: "s4",
    label: METRICS.lineagePersistence.zh,
    metricKey: "lineagePersistenceAvg",
    getThreshold: (p) => p.metricsThresholdsS4?.lineagePersistenceGenerations,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s5-persistence",
    stage: STAGES.s5.zh,
    stageKey: "s5",
    label: METRICS.multicellularPersistence.zh,
    metricKey: "multicellularPersistenceAvg",
    getThreshold: (p) => p.metricsThresholdsS5?.multicellularPersistenceRatio,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s5-labor",
    stage: STAGES.s5.zh,
    stageKey: "s5",
    label: METRICS.divisionOfLabor.zh,
    metricKey: "divisionOfLaborAvg",
    getThreshold: (p) => p.metricsThresholdsS5?.divisionOfLaborColonyShare,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s5-pattern",
    stage: STAGES.s5.zh,
    stageKey: "s5",
    label: METRICS.developmentalPattern.zh,
    metricKey: "developmentalPatternAvg",
    getThreshold: (p) => p.metricsThresholdsS5?.developmentalPatternScore,
    compare: ">=",
    windowLabel: "滑动平均",
  },
];

/** @type {Record<string, { label: string, subtitle: string }>} */
export const STAGE_TREE_META = {
  s1: { label: "前生物化学", subtitle: "代谢场与酶促偶联" },
  s2: { label: "遗传复制", subtitle: "核酸样聚合物" },
  s3: { label: "原细胞", subtitle: "膜与胞质分裂" },
  s4: { label: "整合细胞", subtitle: "代谢耦合" },
  s5: { label: "多细胞生物", subtitle: "群体分工" },
};

/**
 * @param {ConditionDef} def
 * @param {object} metricsHud
 * @param {object} preset
 */
export function evaluateCondition(def, metricsHud, preset) {
  const threshold = def.getThreshold(preset);
  if (threshold == null || !Number.isFinite(threshold)) {
    return { available: false, met: false, current: null, threshold: null, progress: 0 };
  }

  const raw = metricsHud[def.metricKey];
  const current = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  const met = def.compare === ">="
    ? current >= threshold
    : current <= threshold;

  let progress = 0;
  if (def.compare === ">=") {
    progress = threshold > 0 ? Math.min(1, current / threshold) : (met ? 1 : 0);
  } else {
    progress = threshold > 0 ? Math.min(1, threshold / Math.max(current, threshold)) : (met ? 1 : 0);
  }

  return { available: true, met, current, threshold, progress };
}

/**
 * @param {ConditionDef} def
 * @param {object} metricsHud
 * @param {object} preset
 */
export function isConditionMet(def, metricsHud, preset) {
  return evaluateCondition(def, metricsHud, preset).met;
}
