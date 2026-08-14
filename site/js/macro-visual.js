import { ARCHETYPE_META } from "./gene-expression.js";
import { wrapDelta } from "./camera.js";

/** @typedef {{ fill: string, stroke: string, envelope: string, label: string }} MacroStyle */

/** @type {Record<string, MacroStyle>} */
const MACRO_STYLES = {
  cyanophyte: {
    fill: "rgba(72, 168, 96, 0.42)",
    stroke: "rgba(120, 220, 140, 0.9)",
    envelope: "rgba(90, 200, 120, 0.55)",
    label: "生产者",
  },
  chemo_producer: {
    fill: "rgba(60, 150, 110, 0.4)",
    stroke: "rgba(100, 200, 150, 0.88)",
    envelope: "rgba(80, 180, 130, 0.5)",
    label: "化能生产者",
  },
  herbivore: {
    fill: "rgba(200, 140, 70, 0.38)",
    stroke: "rgba(255, 190, 100, 0.88)",
    envelope: "rgba(255, 180, 90, 0.45)",
    label: "消费者",
  },
  predator: {
    fill: "rgba(200, 80, 90, 0.4)",
    stroke: "rgba(255, 120, 130, 0.9)",
    envelope: "rgba(240, 100, 110, 0.5)",
    label: "捕食者",
  },
  anaerobe_decomposer: {
    fill: "rgba(140, 110, 180, 0.35)",
    stroke: "rgba(180, 150, 220, 0.85)",
    envelope: "rgba(160, 130, 200, 0.45)",
    label: "分解者",
  },
  aerobe_decomposer: {
    fill: "rgba(110, 130, 200, 0.36)",
    stroke: "rgba(150, 170, 240, 0.85)",
    envelope: "rgba(130, 150, 220, 0.45)",
    label: "好氧分解者",
  },
  leaky_heterotroph: {
    fill: "rgba(80, 160, 255, 0.32)",
    stroke: "rgba(160, 220, 255, 0.85)",
    envelope: "rgba(140, 200, 240, 0.4)",
    label: "微生物",
  },
};

const DEFAULT_STYLE = MACRO_STYLES.leaky_heterotroph;

/**
 * @param {string | null | undefined} archetype
 * @returns {MacroStyle}
 */
export function macroStyleForArchetype(archetype) {
  return MACRO_STYLES[archetype ?? ""] ?? DEFAULT_STYLE;
}

/**
 * @param {object | null | undefined} chemoton
 */
export function chemotonArchetype(chemoton) {
  if (!chemoton) return "leaky_heterotroph";
  return chemoton.effectiveArchetype ?? chemoton.archetype ?? "leaky_heterotroph";
}

/**
 * @param {string} archetype
 */
export function archetypeMobility(archetype) {
  return ARCHETYPE_META[archetype]?.mobility ?? 0.6;
}

/**
 * @param {string} archetype
 */
export function isProducerArchetype(archetype) {
  return ARCHETYPE_META[archetype]?.trophicRole === "producer";
}

/**
 * @param {object[]} members
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
export function envelopeFromMembers(members, worldWidth, worldHeight) {
  if (!members.length) return null;

  let cx = 0;
  let cy = 0;
  for (const m of members) {
    cx += m.x;
    cy += m.y;
  }
  cx /= members.length;
  cy /= members.length;

  let hullR = 0;
  for (const m of members) {
    const dx = wrapDelta(m.x, cx, worldWidth);
    const dy = wrapDelta(m.y, cy, worldHeight);
    hullR = Math.max(hullR, Math.hypot(dx, dy) + m.radius * 1.15);
  }

  const archCounts = {};
  for (const m of members) {
    const a = chemotonArchetype(m.chemoton);
    archCounts[a] = (archCounts[a] ?? 0) + 1;
  }
  let dominant = "leaky_heterotroph";
  let best = 0;
  for (const [a, c] of Object.entries(archCounts)) {
    if (c > best) {
      best = c;
      dominant = a;
    }
  }

  return {
    cx,
    cy,
    radius: Math.max(hullR, 12),
    dominantArchetype: dominant,
    memberCount: members.length,
  };
}
