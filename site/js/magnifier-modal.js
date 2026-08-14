import { wrapDelta } from "./camera.js";
import {
  decodeSequence,
  readBitField,
  HEADER_BITS,
} from "./gene-expression.js";
import { dominantInteriorSequence } from "./gene-flux.js";
import { archetypeLabelZh } from "./biology-names.js";
import { macroStyleForArchetype, chemotonArchetype } from "./macro-visual.js";

/**
 * @param {import('./world.js').World} world
 * @param {number} wx
 * @param {number} wy
 * @param {number} [searchRadius]
 */
export function findVesicleNear(world, wx, wy, searchRadius = 56) {
  if (!world.vesicle) return null;
  let best = null;
  let bestD2 = searchRadius * searchRadius;
  for (const v of world.vesicle.list) {
    const dx = wrapDelta(wx, v.x, world.width);
    const dy = wrapDelta(wy, v.y, world.height);
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = v;
    }
  }
  return best;
}

/**
 * @param {number[]} sequence
 */
function expressionBarsHtml(sequence) {
  if (!sequence || sequence.length < HEADER_BITS) {
    return "<p class=\"magnifier-modal__empty\">无有效表达头（&lt;12 bit）</p>";
  }
  const m = readBitField(sequence, 0, 4);
  const t = readBitField(sequence, 4, 4);
  const r = readBitField(sequence, 8, 4);
  const decoded = decodeSequence(sequence);

  const bitRow = (label, value, bits) => {
    let cells = "";
    for (let i = bits - 1; i >= 0; i -= 1) {
      const on = (value >> i) & 1;
      cells += `<span class="magnifier-modal__bit${on ? " magnifier-modal__bit--on" : ""}">${on}</span>`;
    }
    return `<div class="magnifier-modal__row"><span class="magnifier-modal__gene">${label}</span>${cells}<span class="magnifier-modal__val">${value}</span></div>`;
  };

  return `
    ${bitRow("M", m, 4)}
    ${bitRow("T", t, 4)}
    ${bitRow("R", r, 4)}
    <p class="magnifier-modal__arch">基因型：${archetypeLabelZh(decoded.archetype)} · 表观：${archetypeLabelZh(decoded.archetype)}</p>
  `;
}

/**
 * Microscopic magnifier (does not pause simulation).
 * @param {HTMLElement} container
 */
export function createMagnifierModal(container) {
  container.className = "magnifier-modal";
  container.hidden = true;
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "false");
  container.setAttribute("aria-label", "局部放大镜");

  container.innerHTML = `
    <div class="magnifier-modal__backdrop" data-action="close"></div>
    <div class="magnifier-modal__dialog">
      <header class="magnifier-modal__header">
        <h2 class="magnifier-modal__title">局部放大镜</h2>
        <button type="button" class="magnifier-modal__btn magnifier-modal__btn--close" id="magnifier-close">关闭</button>
      </header>
      <div class="magnifier-modal__body">
        <canvas id="magnifier-canvas" class="magnifier-modal__canvas" width="220" height="220" aria-hidden="true"></canvas>
        <div id="magnifier-meta" class="magnifier-modal__meta"></div>
        <div id="magnifier-bars" class="magnifier-modal__bars"></div>
      </div>
    </div>
  `;

  const canvas = container.querySelector("#magnifier-canvas");
  const metaEl = container.querySelector("#magnifier-meta");
  const barsEl = container.querySelector("#magnifier-bars");
  const btnClose = container.querySelector("#magnifier-close");
  const backdrop = container.querySelector(".magnifier-modal__backdrop");
  /** @type {CanvasRenderingContext2D | null} */
  const ctx = canvas?.getContext("2d");

  function close() {
    container.hidden = true;
  }

  /**
   * @param {import('./world.js').World} world
   * @param {object} vesicle
   */
  function showVesicle(world, vesicle) {
    if (!ctx || !canvas) return;

    const arch = chemotonArchetype(vesicle.chemoton);
    const style = macroStyleForArchetype(arch);
    const sequence = world.replicator
      ? dominantInteriorSequence(vesicle, world.replicator)
      : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a1018";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const r = Math.min(70, vesicle.radius * 2.2);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (world.replicator && sequence) {
      const n = vesicle.interior?.size ?? 0;
      const spread = Math.min(r * 0.55, 28);
      let i = 0;
      for (const sid of vesicle.interior) {
        const strand = world.replicator.list.find((s) => s.id === sid);
        if (!strand) continue;
        const angle = (i / Math.max(1, n)) * Math.PI * 2;
        const sx = cx + Math.cos(angle) * spread;
        const sy = cy + Math.sin(angle) * spread;
        const hue = (strand.lineageId * 47) % 360;
        ctx.fillStyle = `hsla(${hue}, 75%, 68%, 0.95)`;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        i += 1;
      }
    }

    if (metaEl) {
      metaEl.textContent = `${style.label} · ${arch} · r=${vesicle.radius.toFixed(1)} · 胞内链 ${vesicle.interior?.size ?? 0}`;
    }
    if (barsEl) {
      barsEl.innerHTML = expressionBarsHtml(sequence ?? []);
      const eff = vesicle.chemoton?.effectiveArchetype;
      if (eff && eff !== vesicle.chemoton?.archetype && barsEl.querySelector(".magnifier-modal__arch")) {
        const p = barsEl.querySelector(".magnifier-modal__arch");
        if (p) {
          p.textContent = `基因型：${archetypeLabelZh(vesicle.chemoton.archetype)} · 表观：${archetypeLabelZh(eff)}`;
        }
      }
    }

    container.hidden = false;
  }

  /**
   * @param {import('./world.js').World} world
   * @param {number} wx @param {number} wy
   */
  function showAt(world, wx, wy) {
    const v = findVesicleNear(world, wx, wy);
    if (!v) {
      if (metaEl) metaEl.textContent = "附近无原细胞膜泡";
      if (barsEl) barsEl.innerHTML = "";
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      container.hidden = false;
      return;
    }
    showVesicle(world, v);
  }

  btnClose?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  return {
    showAt,
    showVesicle,
    close,
    isOpen: () => !container.hidden,
  };
}
