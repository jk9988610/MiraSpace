/**
 * Detect metric threshold crossings and emit milestone messages once per run.
 */

/** @typedef {{ id: string, stage: string, label: string, check: (m: object, preset: object) => boolean }} MilestoneDef */

/** @type {MilestoneDef[]} */
const DEFINITIONS = [
  {
    id: "s1-cluster",
    stage: "S1",
    label: "clusterIndex 达到门槛",
    check: (m, p) => m.clusterAvg >= p.metricsThresholds.clusterIndex,
  },
  {
    id: "s1-autocat",
    stage: "S1",
    label: "autocatalyticScore 达到门槛",
    check: (m, p) => m.autocatalyticAvg >= p.metricsThresholds.autocatalyticScore,
  },
  {
    id: "s1-negentropy",
    stage: "S1",
    label: "negentropyFlux 达到门槛",
    check: (m, p) => m.negentropyAvg >= p.metricsThresholds.negentropyFluxRatio,
  },
  {
    id: "s2-heritability",
    stage: "S2",
    label: "heritability 达到门槛",
    check: (m, p) => p.metricsThresholdsS2 && m.heritabilityAvg >= p.metricsThresholdsS2.heritability,
  },
  {
    id: "s2-sweep",
    stage: "S2",
    label: "selectiveSweep 达到门槛",
    check: (m, p) => p.metricsThresholdsS2
      && m.selectiveSweepAvg >= p.metricsThresholdsS2.selectiveSweepTopShare,
  },
  {
    id: "s2-info",
    stage: "S2",
    label: "informationAccumulation 达到门槛",
    check: (m, p) => p.metricsThresholdsS2
      && m.informationAccumulationAvg >= p.metricsThresholdsS2.informationAccumulationRatio,
  },
  {
    id: "s3-encap",
    stage: "S3",
    label: "encapsulationGain 达到门槛",
    check: (m, p) => p.metricsThresholdsS3
      && m.encapsulationGainAvg >= p.metricsThresholdsS3.encapsulationGain,
  },
  {
    id: "s3-fission",
    stage: "S3",
    label: "fissionEvents 达到门槛",
    check: (m, p) => p.metricsThresholdsS3
      && m.fissionEvents >= p.metricsThresholdsS3.fissionEventsPer300s,
  },
  {
    id: "s4-coherence",
    stage: "S4",
    label: "chemotonCoherence 达到门槛",
    check: (m, p) => p.metricsThresholdsS4
      && m.chemotonCoherenceAvg >= p.metricsThresholdsS4.chemotonCoherence,
  },
  {
    id: "s4-lineage",
    stage: "S4",
    label: "lineagePersistence 达到门槛",
    check: (m, p) => p.metricsThresholdsS4
      && m.lineagePersistenceAvg >= p.metricsThresholdsS4.lineagePersistenceGenerations,
  },
  {
    id: "s5-persistence",
    stage: "S5",
    label: "multicellularPersistence 达到门槛",
    check: (m, p) => p.metricsThresholdsS5
      && m.multicellularPersistenceAvg >= p.metricsThresholdsS5.multicellularPersistenceRatio,
  },
  {
    id: "s5-labor",
    stage: "S5",
    label: "divisionOfLabor 达到门槛",
    check: (m, p) => p.metricsThresholdsS5
      && m.divisionOfLaborAvg >= p.metricsThresholdsS5.divisionOfLaborColonyShare,
  },
  {
    id: "s5-pattern",
    stage: "S5",
    label: "developmentalPattern 达到门槛",
    check: (m, p) => p.metricsThresholdsS5
      && m.developmentalPatternAvg >= p.metricsThresholdsS5.developmentalPatternScore,
  },
];

/**
 * @param {{ onMilestone: (msg: string) => void }} handlers
 */
export function createMilestoneTracker(handlers) {
  /** @type {Set<string>} */
  const achieved = new Set();

  function reset() {
    achieved.clear();
  }

  /**
   * @param {object} metricsHud from formatHud()
   * @param {object} preset
   */
  function check(metricsHud, preset) {
    for (const def of DEFINITIONS) {
      if (achieved.has(def.id)) continue;
      if (!def.check(metricsHud, preset)) continue;
      achieved.add(def.id);
      handlers.onMilestone(`里程碑 · ${def.stage}：${def.label}`);
    }
  }

  return { check, reset };
}
