/**
 * Milestone condition definitions shared by tracker and tech-tree UI.
 */

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
    stage: "S1",
    stageKey: "s1",
    label: "clusterIndex",
    metricKey: "clusterAvg",
    getThreshold: (p) => p.metricsThresholds?.clusterIndex,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s1-autocat",
    stage: "S1",
    stageKey: "s1",
    label: "autocatalyticScore",
    metricKey: "autocatalyticAvg",
    getThreshold: (p) => p.metricsThresholds?.autocatalyticScore,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s1-negentropy",
    stage: "S1",
    stageKey: "s1",
    label: "negentropyFlux",
    metricKey: "negentropyAvg",
    getThreshold: (p) => p.metricsThresholds?.negentropyFluxRatio,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s2-heritability",
    stage: "S2",
    stageKey: "s2",
    label: "heritability",
    metricKey: "heritabilityAvg",
    getThreshold: (p) => p.metricsThresholdsS2?.heritability,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s2-sweep",
    stage: "S2",
    stageKey: "s2",
    label: "selectiveSweep",
    metricKey: "selectiveSweepAvg",
    getThreshold: (p) => p.metricsThresholdsS2?.selectiveSweepTopShare,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s2-info",
    stage: "S2",
    stageKey: "s2",
    label: "informationAccumulation",
    metricKey: "informationAccumulationAvg",
    getThreshold: (p) => p.metricsThresholdsS2?.informationAccumulationRatio,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s3-encap",
    stage: "S3",
    stageKey: "s3",
    label: "encapsulationGain",
    metricKey: "encapsulationGainAvg",
    getThreshold: (p) => p.metricsThresholdsS3?.encapsulationGain,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s3-fission",
    stage: "S3",
    stageKey: "s3",
    label: "fissionEvents",
    metricKey: "fissionEvents",
    getThreshold: (p) => p.metricsThresholdsS3?.fissionEventsPer300s,
    compare: ">=",
    windowLabel: "300 s 窗",
  },
  {
    id: "s4-coherence",
    stage: "S4",
    stageKey: "s4",
    label: "chemotonCoherence",
    metricKey: "chemotonCoherenceAvg",
    getThreshold: (p) => p.metricsThresholdsS4?.chemotonCoherence,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s4-lineage",
    stage: "S4",
    stageKey: "s4",
    label: "lineagePersistence",
    metricKey: "lineagePersistenceAvg",
    getThreshold: (p) => p.metricsThresholdsS4?.lineagePersistenceGenerations,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s5-persistence",
    stage: "S5",
    stageKey: "s5",
    label: "multicellularPersistence",
    metricKey: "multicellularPersistenceAvg",
    getThreshold: (p) => p.metricsThresholdsS5?.multicellularPersistenceRatio,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s5-labor",
    stage: "S5",
    stageKey: "s5",
    label: "divisionOfLabor",
    metricKey: "divisionOfLaborAvg",
    getThreshold: (p) => p.metricsThresholdsS5?.divisionOfLaborColonyShare,
    compare: ">=",
    windowLabel: "滑动平均",
  },
  {
    id: "s5-pattern",
    stage: "S5",
    stageKey: "s5",
    label: "developmentalPattern",
    metricKey: "developmentalPatternAvg",
    getThreshold: (p) => p.metricsThresholdsS5?.developmentalPatternScore,
    compare: ">=",
    windowLabel: "滑动平均",
  },
];

/** @type {Record<string, { label: string, subtitle: string }>} */
export const STAGE_TREE_META = {
  s1: { label: "原始汤", subtitle: "场与粒子" },
  s2: { label: "复制子", subtitle: "遗传复制" },
  s3: { label: "原细胞", subtitle: "膜泡分裂" },
  s4: { label: "化学子", subtitle: "代谢耦合" },
  s5: { label: "多细胞", subtitle: "群体分工" },
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
