/**
 * E3: couple gene-expression flux to vesicle chemoton + ecology fields.
 */

import { wrapDelta } from "./camera.js";
import {
  computeEnvGate,
  computeExpressionStrength,
  computeFlux,
  computePredatorTransfer,
  decodeSequence,
  mergeGeneExpressionConfig,
  netOrganicCarbonGain,
  pickDominantSequence,
} from "./gene-expression.js";

/**
 * @param {object} v
 * @param {number} radiusMax
 */
export function updateVesicleBiomass(v, radiusMax) {
  const factor = radiusMax > 0 ? Math.min(1, v.radius / radiusMax) : 0;
  v.biomass = factor * factor;
}

/**
 * @param {object} v
 * @param {import('./vesicle.js').Vesicle} vesicle
 * @param {number} worldWidth
 * @param {number} worldHeight
 * @param {number} searchRadius
 */
export function findNearestPreyVesicle(v, vesicle, worldWidth, worldHeight, searchRadius) {
  let best = null;
  let bestDist2 = searchRadius * searchRadius;

  for (const other of vesicle.list) {
    if (other.id === v.id) continue;
    const preyBiomass = other.biomass ?? 0;
    if (preyBiomass <= 1e-6) continue;

    const dx = wrapDelta(v.x, other.x, worldWidth);
    const dy = wrapDelta(v.y, other.y, worldHeight);
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestDist2) {
      bestDist2 = d2;
      best = other;
    }
  }

  return best;
}

/**
 * @param {object} v
 * @param {import('./replicator.js').Replicator} replicator
 */
export function dominantInteriorSequence(v, replicator) {
  const sequences = [];
  for (const sid of v.interior) {
    const strand = replicator.list.find((s) => s.id === sid);
    if (strand?.sequence) sequences.push(strand.sequence);
  }
  return pickDominantSequence(sequences);
}

/**
 * @param {import('./fields.js').Fields} fields
 * @param {import('./vesicle.js').Vesicle | null} vesicle
 */
export function estimateCarbonPool(fields, vesicle) {
  let pool = 0;

  if (fields.CO2) {
    for (let i = 0; i < fields.CO2.length; i += 1) pool += fields.CO2[i];
  }
  if (fields.DOC) {
    for (let i = 0; i < fields.DOC.length; i += 1) pool += fields.DOC[i];
  }
  if (fields.POC) {
    for (let i = 0; i < fields.POC.length; i += 1) pool += fields.POC[i];
  }

  if (vesicle) {
    for (const v of vesicle.list) {
      pool += v.biomass ?? 0;
    }
  }

  return pool;
}

/**
 * @param {number} before @param {number} after @param {number} [tolerance]
 */
export function carbonBudgetWithinTolerance(before, after, tolerance = 0.15) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  const base = Math.max(1, before);
  return Math.abs(after - before) / base <= tolerance;
}

/**
 * @param {object} preset
 * @param {object} v
 * @param {import('./fields.js').Fields} fields
 * @param {import('./replicator.js').Replicator} replicator
 * @param {import('./vesicle.js').Vesicle} vesicle
 * @param {number} worldWidth
 * @param {number} worldHeight
 * @param {number} dt
 * @param {{ geneFluxTicks?: number, geneFluxO2Delta?: number }} stats
 */
export function applyGeneFluxForVesicle(
  preset,
  v,
  fields,
  replicator,
  vesicle,
  worldWidth,
  worldHeight,
  dt,
  stats,
) {
  if (!v.chemoton || !fields.ecologyEnabled || !preset.geneExpression) return;

  const cfg = mergeGeneExpressionConfig(preset);
  const c = v.chemoton;
  const radiusMax = preset.vesicle?.radiusMax ?? 48;
  updateVesicleBiomass(v, radiusMax);
  const biomassFactor = v.biomass ?? 0;

  const sequence = dominantInteriorSequence(v, replicator);
  const decoded = sequence
    ? decodeSequence(sequence)
    : decodeSequence([]);

  const env = fields.sampleExpressionEnv(v.x, v.y, { light: 1 });
  const envGate = computeEnvGate(decoded, env, cfg);
  const coherenceGate = c.coherenceTicks > 0
    ? 1
    : (cfg.coherenceGateWeak ?? 0.35);
  const redundant = c.storageMode === "redundant";
  const E = computeExpressionStrength(
    c.geneticActivity,
    coherenceGate,
    envGate,
    redundant,
    cfg,
  );

  let hasPrey = false;
  if (decoded.isPredator) {
    const prey = findNearestPreyVesicle(
      v,
      vesicle,
      worldWidth,
      worldHeight,
      v.radius * 2.5,
    );
    hasPrey = prey != null;
  }

  const flux = computeFlux(decoded, E, biomassFactor, cfg, { hasPrey });

  if (decoded.isPredator && hasPrey) {
    const prey = findNearestPreyVesicle(
      v,
      vesicle,
      worldWidth,
      worldHeight,
      v.radius * 2.5,
    );
    if (prey) {
      const transfer = computePredatorTransfer(flux.F, prey.biomass ?? 0, cfg);
      prey.biomass = Math.max(0, (prey.biomass ?? 0) - transfer);
      const docGain = transfer * cfg.predatorReturnToDoc;
      fields.depositEcologyFlux(v.x, v.y, {
        dDOC: docGain,
        dCO2: flux.dCO2,
        dO2: flux.dO2,
        dWaste: flux.dWaste,
        dPOC: flux.dPOC,
      });
    }
  } else {
    fields.depositEcologyFlux(v.x, v.y, {
      dDOC: flux.dDOC,
      dCO2: flux.dCO2,
      dO2: flux.dO2,
      dWaste: flux.dWaste,
      dPOC: flux.dPOC,
    });
  }

  const o2Coupling = preset.atmosphere?.fluxCoupling ?? 0;
  if (o2Coupling > 0 && flux.dO2 > 0) {
    fields.globalO2 = clamp01(fields.globalO2 + flux.dO2 * o2Coupling);
  }

  const coupling = preset.chemoton?.geneFluxCoupling ?? {};
  const fluxGainK = coupling.fluxGainK ?? 0.12;
  const wasteStressK = coupling.wasteStressK ?? 0.35;
  const gain = netOrganicCarbonGain(flux);

  c.metabolicFlux = clamp01(c.metabolicFlux + gain * fluxGainK * dt * 30);
  if (flux.dWaste > 0) {
    c.membraneHealth = clamp01(c.membraneHealth - flux.dWaste * wasteStressK * dt * 30);
  } else if (gain > 0) {
    c.membraneHealth = clamp01(c.membraneHealth + gain * 0.02 * dt * 30);
  }

  c.archetype = decoded.archetype;
  c.effectiveArchetype = decoded.archetype;
  c._lastGeneFlux = flux;
  c._lastExpressionE = E;

  if (E > 1e-4 && flux.F > 1e-6) {
    if (stats.geneFluxTicks != null) stats.geneFluxTicks += 1;
    if (stats.geneFluxO2Delta != null) stats.geneFluxO2Delta += flux.dO2;
  }
}

/** @param {number} x */
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
