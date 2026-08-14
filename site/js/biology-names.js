/**
 * Biological nomenclature for MiraSpace entities (analogical, not literal biochemistry).
 * Code identifiers stay stable; UI/docs use these display names.
 */

/** @typedef {{ code: string, zh: string, en: string, particle?: boolean }} BioLabel */

/** @type {Record<string, BioLabel>} */
export const PARTICLES = {
  monomer: {
    code: "monomer",
    zh: "代谢单体",
    en: "Metabolic monomer",
    particle: true,
  },
  catalyst: {
    code: "catalyst",
    zh: "酶",
    en: "Enzyme",
    particle: true,
  },
  dimer: {
    code: "dimer",
    zh: "生物大分子二聚体",
    en: "Macromolecular dimer",
    particle: true,
  },
};

/** @type {Record<string, BioLabel>} */
export const ENTITIES = {
  strand: {
    code: "strand",
    zh: "核酸样聚合物",
    en: "Polynucleotide strand",
  },
  vesicle: {
    code: "vesicle",
    zh: "原细胞膜泡",
    en: "Protocell vesicle",
  },
  chemoton: {
    code: "chemoton",
    zh: "整合细胞",
    en: "Integrated chemoton cell",
  },
  colony: {
    code: "colony",
    zh: "多细胞群体",
    en: "Multicellular colony",
  },
};

/** @type {Record<string, { zh: string, en: string, subtitle: string }>} */
export const STAGES = {
  s1: {
    zh: "前生物化学",
    en: "Prebiotic chemistry",
    subtitle: "代谢场 · 酶促偶联",
  },
  s2: {
    zh: "遗传复制",
    en: "Genetic replication",
    subtitle: "核酸样聚合物 · 自然选择",
  },
  s3: {
    zh: "原细胞",
    en: "Protocell",
    subtitle: "细胞膜 · 胞质封装 · 细胞分裂",
  },
  s4: {
    zh: "整合细胞",
    en: "Integrated cell",
    subtitle: "代谢·膜·遗传耦合",
  },
  s5: {
    zh: "多细胞生物",
    en: "Multicellular organism",
    subtitle: "细胞黏附 · 分工 · 发育模式",
  },
};

/** @type {Record<string, { zh: string, en: string }>} */
export const METRICS = {
  clusterIndex: { zh: "簇集指数", en: "Cluster index" },
  autocatalyticScore: { zh: "自催化得分", en: "Autocatalytic score" },
  negentropyFlux: { zh: "负熵通量", en: "Negentropy flux" },
  heritability: { zh: "遗传度", en: "Heritability" },
  selectiveSweep: { zh: "选择扫荡", en: "Selective sweep" },
  informationAccumulation: { zh: "信息累积", en: "Information accumulation" },
  parasiteFraction: { zh: "寄生序列占比", en: "Parasite fraction" },
  encapsulationGain: { zh: "封装增益", en: "Encapsulation gain" },
  parasiteLoad: { zh: "胞外寄生负载", en: "Parasite load" },
  fissionEvents: { zh: "细胞分裂事件", en: "Fission events" },
  vesicleCount: { zh: "原细胞数", en: "Vesicle count" },
  chemotonCoherence: { zh: "细胞协调度", en: "Chemoton coherence" },
  lineagePersistence: { zh: "谱系延续", en: "Lineage persistence" },
  storageFidelity: { zh: "基因组保真", en: "Storage fidelity" },
  chemotonCount: { zh: "协调细胞数", en: "Coherent cell count" },
  multicellularPersistence: { zh: "多细胞持续性", en: "Multicellular persistence" },
  divisionOfLabor: { zh: "细胞分工", en: "Division of labor" },
  developmentalPattern: { zh: "发育模式", en: "Developmental pattern" },
  colonyCount: { zh: "群体数", en: "Colony count" },
};

/** @param {BioLabel} label */
export function particleLegendLine(label) {
  return `${label.zh}（${label.en}）`;
}

/** @param {string} key */
export function metricLabelZh(key) {
  return METRICS[key]?.zh ?? key;
}

/** @param {string} key */
export function entityLabelZh(key) {
  return ENTITIES[key]?.zh ?? PARTICLES[key]?.zh ?? key;
}

/** @param {string} key */
export function stageLabelZh(key) {
  return STAGES[key]?.zh ?? key;
}

/**
 * Apply biology display names to HUD metric labels (keeps code ids in subtitle).
 */
export function applyHudBiologyLabels() {
  const hud = document.getElementById("hud");
  if (!hud) return;

  for (const el of hud.querySelectorAll("[data-metric]")) {
    const key = el.getAttribute("data-metric");
    const m = METRICS[key];
    if (!m) continue;
    el.innerHTML =
      `<span class="hud__metric-name">${m.zh}</span>`
      + `<span class="hud__metric-code">${key}</span>`;
  }

  for (const el of hud.querySelectorAll("[data-stage-section]")) {
    const key = el.getAttribute("data-stage-section");
    const s = STAGES[key];
    if (s) el.textContent = s.zh;
  }

  for (const el of hud.querySelectorAll("[data-entity-count]")) {
    const key = el.getAttribute("data-entity-count");
    const label = entityLabelZh(key);
    const span = el.querySelector("span");
    if (span) span.textContent = label;
  }
}
