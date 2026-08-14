import { wrapCoord } from "./camera.js";

/** @typedef {"atmosphere"|"biosphere"|"ocean"|"land"|"sediment"} EarthZone */

/**
 * E6: profile coordinates — x = longitude, y = altitude / depth.
 * Terrain zones + solar light field (world-fixed; pans with heatmap).
 */
export class EarthProfile {
  /**
   * @param {object} preset
   * @param {number} worldWidth
   * @param {number} worldHeight
   * @param {number} gridW
   * @param {number} gridH
   */
  constructor(preset, worldWidth, worldHeight, gridW, gridH) {
    const cfg = preset.earthProfile ?? {};
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.gridW = gridW;
    this.gridH = gridH;

    const bands = cfg.bands ?? {};
    this.sedimentTop = bands.sedimentTop ?? 0.12;
    this.oceanTop = bands.oceanTop ?? 0.42;
    this.landTop = bands.landTop ?? 0.48;
    this.biosphereTop = bands.biosphereTop ?? 0.72;

    this.depthAttenuationK = cfg.depthAttenuationK ?? 0.85;
    this.solarPhase = cfg.solarPhase ?? 0.25;
    this.solarDrift = cfg.solarDrift ?? 0;
    this.nightThreshold = cfg.nightThreshold ?? 0.12;

    this.sedimentDocMult = cfg.sedimentDocMult ?? 2.8;
    this.sedimentPocMult = cfg.sedimentPocMult ?? 3.2;

    this._simTime = 0;
    /** @type {EarthZone[]} */
    this._zoneGrid = new Array(gridW * gridH);
    this._buildZoneGrid();
  }

  /** @param {number} simTime */
  setSimTime(simTime) {
    this._simTime = simTime;
  }

  /** @param {number} wy */
  _yNorm(wy) {
    return wrapCoord(wy, this.worldHeight) / this.worldHeight;
  }

  /**
   * @param {number} wy
   * @returns {EarthZone}
   */
  zoneAt(wy) {
    const yn = this._yNorm(wy);
    if (yn < this.sedimentTop) return "sediment";
    if (yn < this.oceanTop) return "ocean";
    if (yn < this.landTop) return "land";
    if (yn < this.biosphereTop) return "biosphere";
    return "atmosphere";
  }

  /**
   * @param {number} gx @param {number} gy
   * @returns {EarthZone}
   */
  zoneAtGrid(gx, gy) {
    return this._zoneGrid[gy * this.gridW + gx];
  }

  _buildZoneGrid() {
    for (let gy = 0; gy < this.gridH; gy += 1) {
      const wy = (gy + 0.5) * (this.worldHeight / this.gridH);
      const zone = this.zoneAt(wy);
      for (let gx = 0; gx < this.gridW; gx += 1) {
        this._zoneGrid[gy * this.gridW + gx] = zone;
      }
    }
  }

  /**
   * Normalized ocean depth 0 (surface) … 1 (sediment floor).
   * @param {number} wy
   */
  depthAt(wy) {
    const yn = this._yNorm(wy);
    if (yn >= this.oceanTop) return 0;
    const floor = this.sedimentTop;
    const span = this.oceanTop - floor;
    if (span <= 0) return 0;
    const d = this.oceanTop - yn;
    return clamp01(d / span);
  }

  /**
   * @param {number} wx
   */
  solarLongitude(wx) {
    const lon = wrapCoord(wx, this.worldWidth) / this.worldWidth;
    const phase = this.solarPhase + this.solarDrift * this._simTime;
    const wrappedPhase = phase % 1;
    const angle = 2 * Math.PI * (lon - wrappedPhase);
    return clamp01(0.5 + 0.5 * Math.cos(angle));
  }

  /**
   * @param {number} wx @param {number} wy
   */
  sampleLight(wx, wy) {
    const sun = this.solarLongitude(wx);
    const depth = this.depthAt(wy);
    const zone = this.zoneAt(wy);
    if (zone === "sediment") {
      return sun * Math.exp(-depth * this.depthAttenuationK * 1.4);
    }
    if (zone === "ocean") {
      return sun * Math.exp(-depth * this.depthAttenuationK);
    }
    if (zone === "atmosphere" || zone === "biosphere") {
      return sun;
    }
    return sun * 0.92;
  }

  /**
   * @param {number} wx @param {number} wy
   */
  sampleEnv(wx, wy) {
    const zone = this.zoneAt(wy);
    const light = this.sampleLight(wx, wy);
    return {
      light,
      isNight: light < this.nightThreshold,
      isLand: zone === "land" || zone === "biosphere",
      depth: this.depthAt(wy),
      zone,
    };
  }

  /**
   * Apply higher DOC/POC baselines in sediment cells (E6).
   * @param {import('./fields.js').Fields} fields
   */
  seedEcologyBaselines(fields) {
    if (!fields.ecologyEnabled) return;

    const docBase = fields.DOCCfg?.baseline ?? 0.05;
    const pocBase = fields.POCCfg?.baseline ?? 0.02;

    for (let gy = 0; gy < this.gridH; gy += 1) {
      for (let gx = 0; gx < this.gridW; gx += 1) {
        const idx = gy * this.gridW + gx;
        const zone = this.zoneAtGrid(gx, gy);
        if (zone === "sediment" && fields.DOC) {
          fields.DOC[idx] = docBase * this.sedimentDocMult;
        }
        if (zone === "sediment" && fields.POC) {
          fields.POC[idx] = pocBase * this.sedimentPocMult;
        }
      }
    }
  }

  /**
   * Zone band colors for profile overlay (RGBA strings).
   * @returns {Record<EarthZone, string>}
   */
  zoneColors() {
    return {
      atmosphere: "rgba(120, 160, 220, 0.06)",
      biosphere: "rgba(100, 200, 140, 0.07)",
      land: "rgba(180, 150, 90, 0.09)",
      ocean: "rgba(40, 100, 180, 0.08)",
      sediment: "rgba(90, 70, 50, 0.10)",
    };
  }

  /**
   * Draw horizontal zone bands (world-fixed; pans with heatmap).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   */
  drawZoneBands(ctx, camera) {
    const bounds = camera.getViewBounds();
    const colors = this.zoneColors();
    const bands = [
      { top: this.biosphereTop, bottom: 1, zone: "atmosphere" },
      { top: this.landTop, bottom: this.biosphereTop, zone: "biosphere" },
      { top: this.oceanTop, bottom: this.landTop, zone: "land" },
      { top: this.sedimentTop, bottom: this.oceanTop, zone: "ocean" },
      { top: 0, bottom: this.sedimentTop, zone: "sediment" },
    ];

    const xShifts = wrapShifts(bounds.left, bounds.right, this.worldWidth);
    for (const ox of xShifts) {
      for (const band of bands) {
        const yBottom = band.bottom * this.worldHeight;
        const yTop = band.top * this.worldHeight;
        const tl = camera.worldToScreen(bounds.left + ox, yTop);
        const br = camera.worldToScreen(bounds.right + ox, yBottom);
        ctx.fillStyle = colors[band.zone];
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }
    }
  }
}

/**
 * @param {number} low @param {number} high @param {number} size
 */
function wrapShifts(low, high, size) {
  const margin = size * 0.05;
  const shifts = [0];
  if (low < margin) shifts.push(size);
  if (high > size - margin) shifts.push(-size);
  return shifts;
}

/** @param {number} v */
function clamp01(v) {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}
