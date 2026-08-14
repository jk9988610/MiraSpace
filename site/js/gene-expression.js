/**
 * Gene expression: 12-bit header (M|T|R) → archetype → field flux.
 * Pure functions; no field/world coupling (E1).
 */

/** @typedef {'oxy_photo'|'chemo_auto'|'aero_resp'|'ferment'|'aero_decomp'|'leaky'|'off'} MetabolicMode */

/** @typedef {'autotroph'|'herbivore'|'predator'|'decomposer'|'mixotroph'|'generalist'} TrophicMode */

/**
 * @typedef {'cyanophyte'|'chemo_producer'|'herbivore'|'predator'|'anaerobe_decomposer'|'aerobe_decomposer'|'leaky_heterotroph'} ArchetypeId
 */

/**
 * @typedef {{
 *   headerBits: number,
 *   fluxCoeffs: { alpha: number, beta: number, gamma: number, delta: number },
 *   envK: { CO2: number, O2: number, DOC: number, O2_tox: number, POC?: number, energy?: number },
 *   F_max: number,
 *   nightFactor: number,
 *   coherenceGateWeak: number,
 *   redundantExpressionBonus: number,
 *   generalistEfficiency: number,
 *   predatorTransfer: number,
 *   predatorReturnToDoc: number,
 *   predatorStressFactor: number,
 *   leakyFluxScale: number,
 *   diffIntervalTicks: number,
 * }} GeneExpressionConfig
 */

/**
 * @typedef {{
 *   M: number,
 *   T: number,
 *   R: number,
 *   metabolicMode: MetabolicMode,
 *   trophicMode: TrophicMode,
 *   archetype: ArchetypeId,
 *   canExpress: boolean,
 *   allowsPhenotypicDiff: boolean,
 *   aerobicTolerance: boolean,
 *   photoperiod: boolean,
 *   landPreference: boolean,
 *   mobility: number,
 *   isProducer: boolean,
 *   isConsumer: boolean,
 *   isDecomposer: boolean,
 *   isPredator: boolean,
 * }} DecodedExpression
 */

/**
 * @typedef {{
 *   light?: number,
 *   CO2?: number,
 *   O2?: number,
 *   DOC?: number,
 *   POC?: number,
 *   waste?: number,
 *   energy?: number,
 *   isNight?: boolean,
 *   isLand?: boolean,
 *   depth?: number,
 * }} ExpressionEnv
 */

/**
 * @typedef {{
 *   dDOC: number,
 *   dCO2: number,
 *   dO2: number,
 *   dWaste: number,
 *   dPOC: number,
 *   F: number,
 *   E: number,
 *   envGate: number,
 * }} FluxResult
 */

export const HEADER_BITS = 12;

export const DEFAULT_GENE_EXPRESSION_CONFIG = {
  headerBits: 12,
  fluxCoeffs: { alpha: 0.04, beta: 0.04, gamma: 0.03, delta: 0.02 },
  envK: { CO2: 0.15, O2: 0.08, DOC: 0.12, O2_tox: 0.25, POC: 0.1, energy: 0.2 },
  F_max: 1.0,
  nightFactor: 0.15,
  coherenceGateWeak: 0.35,
  redundantExpressionBonus: 1.1,
  generalistEfficiency: 0.6,
  predatorTransfer: 0.08,
  predatorReturnToDoc: 0.5,
  predatorStressFactor: 0.1,
  leakyFluxScale: 0.15,
  diffIntervalTicks: 30,
};

/** @type {Record<ArchetypeId, { mobility: number, trophicRole: string }>} */
export const ARCHETYPE_META = {
  cyanophyte: { mobility: 0, trophicRole: "producer" },
  chemo_producer: { mobility: 0, trophicRole: "producer" },
  herbivore: { mobility: 1, trophicRole: "consumer" },
  predator: { mobility: 1, trophicRole: "consumer" },
  anaerobe_decomposer: { mobility: 0.5, trophicRole: "decomposer" },
  aerobe_decomposer: { mobility: 0.5, trophicRole: "decomposer" },
  leaky_heterotroph: { mobility: 0.6, trophicRole: "consumer" },
};

/**
 * @param {object} [preset]
 * @returns {GeneExpressionConfig}
 */
export function mergeGeneExpressionConfig(preset) {
  const src = preset?.geneExpression ?? {};
  return {
    ...DEFAULT_GENE_EXPRESSION_CONFIG,
    ...src,
    fluxCoeffs: { ...DEFAULT_GENE_EXPRESSION_CONFIG.fluxCoeffs, ...src.fluxCoeffs },
    envK: { ...DEFAULT_GENE_EXPRESSION_CONFIG.envK, ...src.envK },
  };
}

/** @param {number[]} sequence @param {number} start @param {number} len */
export function readBitField(sequence, start, len) {
  let v = 0;
  for (let i = 0; i < len; i += 1) {
    v = (v << 1) | (sequence[start + i] ? 1 : 0);
  }
  return v;
}

/** @param {number} m @param {number} t */
export function resolveArchetype(m, t) {
  const metabolic = metabolicFromNibble(m);
  const trophic = trophicFromNibble(t);

  if (metabolic === "oxy_photo" && trophic === "autotroph") return "cyanophyte";
  if (metabolic === "chemo_auto" && trophic === "autotroph") return "chemo_producer";
  if (metabolic === "aero_resp" && trophic === "herbivore") return "herbivore";
  if (metabolic === "aero_resp" && trophic === "predator") return "predator";
  if (metabolic === "ferment" && trophic === "decomposer") return "anaerobe_decomposer";
  if (metabolic === "aero_decomp" && trophic === "decomposer") return "aerobe_decomposer";
  return "leaky_heterotroph";
}

/** @param {number} nibble */
export function metabolicFromNibble(nibble) {
  const v = nibble & 7;
  if (v === 0) return "oxy_photo";
  if (v === 1) return "chemo_auto";
  if (v === 2) return "aero_resp";
  if (v === 3) return "ferment";
  if (v === 4) return "aero_decomp";
  if (v === 5) return "leaky";
  return "off";
}

/** @param {number} nibble */
export function trophicFromNibble(nibble) {
  const v = nibble & 7;
  if (v === 0) return "autotroph";
  if (v === 1) return "herbivore";
  if (v === 2) return "predator";
  if (v === 3) return "decomposer";
  if (v === 4) return "mixotroph";
  return "generalist";
}

/**
 * @param {number} m @param {number} t @param {number} r @param {boolean} canExpress
 */
function buildDecoded(m, t, r, canExpress) {
  const metabolicMode = canExpress ? metabolicFromNibble(m) : "leaky";
  const trophicMode = canExpress ? trophicFromNibble(t) : "generalist";
  const archetype = canExpress ? resolveArchetype(m, t) : "leaky_heterotroph";
  const meta = ARCHETYPE_META[archetype];

  return {
    M: m,
    T: t,
    R: r,
    metabolicMode,
    trophicMode,
    archetype,
    canExpress,
    allowsPhenotypicDiff: canExpress && (r & 8) !== 0,
    aerobicTolerance: (r & 1) !== 0,
    photoperiod: (r & 2) !== 0,
    landPreference: (r & 4) !== 0,
    mobility: meta.mobility,
    isProducer: meta.trophicRole === "producer",
    isConsumer: meta.trophicRole === "consumer",
    isDecomposer: meta.trophicRole === "decomposer",
    isPredator: archetype === "predator",
  };
}

/**
 * @param {number[]} sequence
 * @param {{ effectiveM?: number, effectiveT?: number }} [overrides]
 */
export function decodeSequence(sequence, overrides = {}) {
  if (!sequence || sequence.length < HEADER_BITS) {
    return buildDecoded(0, 0, 0, false);
  }

  const m = overrides.effectiveM ?? readBitField(sequence, 0, 4);
  const t = overrides.effectiveT ?? readBitField(sequence, 4, 4);
  const r = readBitField(sequence, 8, 4);
  return buildDecoded(m, t, r, true);
}

/** @param {number} m @param {number} t @param {number} [r] @param {number} [junkLen] */
export function buildExpressionHeader(m, t, r = 0, junkLen = 0) {
  const seq = [];
  for (let i = 3; i >= 0; i -= 1) seq.push((m >> i) & 1);
  for (let i = 3; i >= 0; i -= 1) seq.push((t >> i) & 1);
  for (let i = 3; i >= 0; i -= 1) seq.push((r >> i) & 1);
  for (let i = 0; i < junkLen; i += 1) seq.push(0);
  return seq;
}

/** @param {number} v */
export function clamp01(v) {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

/**
 * Weighted nucleation header for earth preset (still emergent junk tail).
 * @param {ReturnType<import('./camera.js').createRng>} rng
 * @param {number} length
 * @param {Array<{ m: number, t: number, r?: number, weight?: number }>} profiles
 */
export function randomNucleationSequence(rng, length, profiles) {
  const len = Math.max(HEADER_BITS, length);
  if (!profiles?.length) {
    const seq = [];
    for (let i = 0; i < len; i += 1) seq.push(rng.int(2));
    return seq;
  }

  let total = 0;
  for (const p of profiles) total += p.weight ?? 1;
  let pick = rng.next() * total;
  let chosen = profiles[0];
  for (const p of profiles) {
    pick -= p.weight ?? 1;
    if (pick <= 0) {
      chosen = p;
      break;
    }
  }

  const header = buildExpressionHeader(chosen.m, chosen.t, chosen.r ?? 0, 0);
  const seq = [...header];
  while (seq.length < len) seq.push(rng.int(2));
  return seq.slice(0, len);
}

/**
 * @param {number} c @param {number} k
 */
export function saturating(c, k) {
  if (k <= 0) return clamp01(c);
  return clamp01(c / (c + k));
}

/**
 * @param {number} o2 @param {number} tox
 */
export function o2Inhibit(o2, tox) {
  if (tox <= 0) return 1;
  const r = o2 / tox;
  return 1 / (1 + r * r);
}

/**
 * @param {DecodedExpression} decoded
 * @param {ExpressionEnv} env
 * @param {GeneExpressionConfig} cfg
 */
export function computeEnvGate(decoded, env, cfg) {
  const k = cfg.envK;
  const light = clamp01(env.light ?? 1);
  const CO2 = env.CO2 ?? 0;
  const O2 = env.O2 ?? 0;
  const DOC = env.DOC ?? 0;
  const POC = env.POC ?? 0;
  const waste = env.waste ?? 0;
  const energy = env.energy ?? 0;
  const isNight = env.isNight ?? false;
  const isLand = env.isLand ?? false;

  let gate = 1;

  if (decoded.photoperiod && isNight) {
    gate *= cfg.nightFactor;
  }

  if (decoded.landPreference) {
    gate *= isLand ? 1.2 : 0.9;
  }

  const anaerobicModes = ["ferment", "anaerobe_decomposer"];
  const isAnaerobicPath = decoded.metabolicMode === "ferment"
    || decoded.archetype === "anaerobe_decomposer";
  if (isAnaerobicPath && !decoded.aerobicTolerance) {
    gate *= o2Inhibit(O2, k.O2_tox);
  }

  const mode = decoded.metabolicMode;
  let pathwayGate = 0;

  if (mode === "oxy_photo") {
    pathwayGate = light * saturating(CO2, k.CO2) * o2Inhibit(O2, k.O2_tox);
  } else if (mode === "chemo_auto") {
    pathwayGate = saturating(energy, k.energy ?? 0.2) * saturating(CO2, k.CO2);
  } else if (mode === "aero_resp") {
    pathwayGate = saturating(O2, k.O2) * saturating(DOC, k.DOC);
  } else if (mode === "ferment") {
    pathwayGate = saturating(DOC, k.DOC);
    if (decoded.trophicMode === "decomposer") {
      pathwayGate = Math.max(pathwayGate, saturating(POC, k.POC ?? 0.1) * 0.8);
    }
  } else if (mode === "aero_decomp") {
    const pocK = k.POC ?? 0.1;
    pathwayGate = saturating(O2, k.O2)
      * Math.max(saturating(DOC, k.DOC), saturating(POC, pocK) * 0.7, saturating(waste, k.DOC));
  } else if (mode === "leaky") {
    pathwayGate = 0.25;
  } else if (mode === "off") {
    pathwayGate = 0;
  }

  if (decoded.trophicMode === "generalist" && mode !== "off") {
    pathwayGate *= cfg.generalistEfficiency;
  }

  if (decoded.trophicMode === "mixotroph" && mode === "oxy_photo") {
    pathwayGate = Math.max(pathwayGate, light * saturating(DOC, k.DOC) * 0.35);
  }

  return clamp01(gate * pathwayGate);
}

/**
 * @param {number} geneticActivity
 * @param {number} coherenceGate
 * @param {number} envGate
 * @param {boolean} [redundantStorage]
 * @param {GeneExpressionConfig} cfg
 */
export function computeExpressionStrength(
  geneticActivity,
  coherenceGate,
  envGate,
  redundantStorage,
  cfg,
) {
  let e = clamp01(geneticActivity) * clamp01(coherenceGate) * clamp01(envGate);
  if (redundantStorage) e *= cfg.redundantExpressionBonus;
  return e;
}

/**
 * @param {number} mNibble
 */
export function metabolicStrengthScale(mNibble) {
  const highBit = (mNibble >> 3) & 1;
  return 0.85 + 0.15 * highBit;
}

/**
 * @param {DecodedExpression} decoded
 * @param {number} E
 * @param {number} biomassFactor
 * @param {GeneExpressionConfig} cfg
 * @param {{ hasPrey?: boolean }} [opts]
 */
export function computeFlux(decoded, E, biomassFactor, cfg, opts = {}) {
  const coeffs = cfg.fluxCoeffs;
  let fScale = metabolicStrengthScale(decoded.M);
  let F = cfg.F_max * E * clamp01(biomassFactor) * fScale;

  if (decoded.isPredator && !opts.hasPrey) {
    F *= cfg.predatorStressFactor;
  }

  const zero = { dDOC: 0, dCO2: 0, dO2: 0, dWaste: 0, dPOC: 0, F: 0, E, envGate: 0 };

  if (F <= 0 || decoded.metabolicMode === "off") {
    return { ...zero, F, E };
  }

  const { alpha, beta, gamma, delta } = coeffs;
  let dDOC = 0;
  let dCO2 = 0;
  let dO2 = 0;
  let dWaste = 0;
  let dPOC = 0;

  const archetype = decoded.archetype;

  if (archetype === "cyanophyte") {
    dDOC = alpha * F;
    dCO2 = -beta * F;
    dO2 = gamma * F;
    dWaste = delta * F;
  } else if (archetype === "chemo_producer") {
    dDOC = alpha * F;
    dCO2 = -beta * F;
    dWaste = delta * F;
  } else if (archetype === "herbivore") {
    dDOC = -alpha * F;
    dCO2 = beta * F;
    dO2 = -gamma * F;
    dWaste = delta * F;
  } else if (archetype === "predator") {
    dDOC = alpha * F * cfg.predatorReturnToDoc;
    dCO2 = beta * F * 0.3;
    dO2 = -gamma * F * 0.2;
    dWaste = delta * F;
  } else if (archetype === "anaerobe_decomposer") {
    dDOC = -alpha * F * 0.5;
    dPOC = -alpha * F * 0.5;
    dCO2 = beta * F * 0.5;
    dWaste = -delta * F;
  } else if (archetype === "aerobe_decomposer") {
    dDOC = -alpha * F;
    dCO2 = beta * F;
    dO2 = -gamma * F;
    dWaste = -delta * F * 1.5;
    dPOC = -alpha * F * 0.4;
  } else {
    const s = cfg.leakyFluxScale * F;
    dCO2 = beta * s;
    dWaste = delta * s * 0.5;
  }

  return { dDOC, dCO2, dO2, dWaste, dPOC, F, E, envGate: 0 };
}

/**
 * @param {number} F
 * @param {number} preyBiomass
 * @param {GeneExpressionConfig} cfg
 */
export function computePredatorTransfer(F, preyBiomass, cfg) {
  const cap = preyBiomass * 0.1;
  const transfer = Math.min(F * cfg.predatorTransfer, cap);
  return Math.max(0, transfer);
}

/**
 * @param {number[]} sequences
 */
export function pickDominantSequence(sequences) {
  if (!sequences?.length) return null;
  let best = sequences[0];
  for (const s of sequences) {
    if (s.length > best.length) best = s;
  }
  return best;
}

/**
 * Phenotypic differentiation (does not mutate sequence).
 * @param {DecodedExpression} decoded
 * @param {{ localDOC?: number, localLight?: number, meanDOC?: number, meanLight?: number }} ctx
 */
export function computeEffectivePhenotype(decoded, ctx) {
  if (!decoded.canExpress || !decoded.allowsPhenotypicDiff) {
    return { effectiveM: decoded.M, effectiveT: decoded.T, effectiveArchetype: decoded.archetype };
  }

  let effectiveM = decoded.M;
  let effectiveT = decoded.T;
  const localDOC = ctx.localDOC ?? 0;
  const localLight = ctx.localLight ?? 0;
  const meanDOC = ctx.meanDOC ?? localDOC;
  const meanLight = ctx.meanLight ?? localLight;

  if (localDOC > meanDOC && decoded.trophicMode !== "predator") {
    effectiveT = (effectiveT & 0x8) | 3;
    effectiveM = (effectiveM & 0x8) | 3;
  } else if (localLight > meanLight && (decoded.M & 7) === 0) {
    effectiveM = decoded.M & 0x8;
  }

  const effectiveArchetype = resolveArchetype(effectiveM, effectiveT);
  return { effectiveM, effectiveT, effectiveArchetype };
}

/**
 * Net organic carbon gain (for metabolicFlux coupling in E3).
 * @param {FluxResult} flux
 */
export function netOrganicCarbonGain(flux) {
  return flux.dDOC - flux.dPOC * 0.5;
}
