import { wrapCoord } from "./camera.js";

const ECOLOGY_KEYS = ["CO2", "O2", "DOC", "POC"];

/**
 * Scalar fields on a coarse grid with wrap diffusion.
 * Optional ecology channels (CO₂/O₂/DOC/POC) + global atmosphere (E2).
 */
export class Fields {
  /**
   * @param {object} preset
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(preset, worldWidth, worldHeight) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.gridW = preset.fields.width;
    this.gridH = preset.fields.height;
    this.cellW = worldWidth / this.gridW;
    this.cellH = worldHeight / this.gridH;

    const size = this.gridW * this.gridH;
    this.energy = new Float32Array(size);
    this.waste = new Float32Array(size);
    this._energyNext = new Float32Array(size);
    this._wasteNext = new Float32Array(size);

    this.energyCfg = preset.fields.energy;
    this.wasteCfg = preset.fields.waste;
    this.heatmapOpacity = preset.fields.heatmapOpacity;
    this.updateStride = preset.performance?.fieldUpdateStride ?? 1;
    this.heatmapTileSize = preset.performance?.heatmapTileSize
      ?? preset.render?.heatmapTileSize
      ?? 16;
    this._tick = 0;

    for (let i = 0; i < size; i += 1) {
      this.energy[i] = this.energyCfg.baseline;
      this.waste[i] = 0;
    }

    /** @type {string[]} */
    this.ecologyKeys = [];
    this.ecologyEnabled = false;

    for (const key of ECOLOGY_KEYS) {
      const cfg = preset.fields?.[key];
      if (!cfg) continue;
      this.ecologyEnabled = true;
      this.ecologyKeys.push(key);
      this[key] = new Float32Array(size);
      this[`_${key}Next`] = new Float32Array(size);
      this[`${key}Cfg`] = {
        baseline: cfg.baseline ?? 0,
        diffusion: cfg.diffusion ?? 0.2,
        max: cfg.max ?? 1,
        decay: cfg.decay ?? 0,
      };
      const baseline = this[`${key}Cfg`].baseline;
      for (let i = 0; i < size; i += 1) {
        this[key][i] = baseline;
      }
    }

    const atmo = preset.atmosphere ?? {};
    this.globalCO2 = atmo.globalCO2 ?? preset.fields?.CO2?.baseline ?? 0.35;
    this.globalO2 = atmo.globalO2 ?? preset.fields?.O2?.baseline ?? 0.02;
    this.oceanEquilRate = atmo.oceanEquilRate ?? 0.01;
    this.atmosphereBiosphereFeedback = atmo.biosphereFeedback ?? 0.05;

    /** @type {import('./earth-profile.js').EarthProfile | null} */
    this.earthProfile = null;
  }

  /**
   * @param {import('./earth-profile.js').EarthProfile} profile
   */
  attachEarthProfile(profile) {
    this.earthProfile = profile;
    profile.seedEcologyBaselines(this);
  }

  /** @param {number} wx @param {number} wy */
  worldToGrid(wx, wy) {
    const gx = Math.min(this.gridW - 1, Math.max(0, Math.floor(wrapCoord(wx, this.worldWidth) / this.cellW)));
    const gy = Math.min(this.gridH - 1, Math.max(0, Math.floor(wrapCoord(wy, this.worldHeight) / this.cellH)));
    return { gx, gy };
  }

  /** @param {number} wx @param {number} wy */
  gridIndex(wx, wy) {
    const { gx, gy } = this.worldToGrid(wx, wy);
    return gy * this.gridW + gx;
  }

  /** @param {number} wx @param {number} wy */
  sampleEnergy(wx, wy) {
    return this._bilinearSample(this.energy, wx, wy);
  }

  /** @param {number} wx @param {number} wy */
  sampleWaste(wx, wy) {
    return this._bilinearSample(this.waste, wx, wy);
  }

  /** @param {string} key @param {number} wx @param {number} wy */
  sampleEcology(key, wx, wy) {
    const field = this[key];
    if (!field) return 0;
    return this._bilinearSample(field, wx, wy);
  }

  /** @param {number} wx @param {number} wy */
  sampleCO2(wx, wy) {
    return this.sampleEcology("CO2", wx, wy);
  }

  /** @param {number} wx @param {number} wy */
  sampleO2(wx, wy) {
    return this.sampleEcology("O2", wx, wy);
  }

  /** @param {number} wx @param {number} wy */
  sampleDOC(wx, wy) {
    return this.sampleEcology("DOC", wx, wy);
  }

  /** @param {number} wx @param {number} wy */
  samplePOC(wx, wy) {
    return this.sampleEcology("POC", wx, wy);
  }

  /**
   * Environment sample for gene-expression envGate (E3).
   * @param {number} wx @param {number} wy @param {{ light?: number, isNight?: boolean, isLand?: boolean, depth?: number }} [opts]
   */
  sampleExpressionEnv(wx, wy, opts = {}) {
    const prof = this.earthProfile?.sampleEnv(wx, wy) ?? {};
    return {
      light: opts.light ?? prof.light ?? 1,
      CO2: this.sampleCO2(wx, wy),
      O2: this.sampleO2(wx, wy),
      DOC: this.sampleDOC(wx, wy),
      POC: this.samplePOC(wx, wy),
      waste: this.sampleWaste(wx, wy),
      energy: this.sampleEnergy(wx, wy),
      isNight: opts.isNight ?? prof.isNight ?? false,
      isLand: opts.isLand ?? prof.isLand ?? false,
      depth: opts.depth ?? prof.depth ?? 0,
      zone: prof.zone,
    };
  }

  /** @param {number} wx @param {number} wy @param {number} amount */
  consumeEnergy(wx, wy, amount) {
    const idx = this.gridIndex(wx, wy);
    const taken = Math.min(this.energy[idx], amount);
    this.energy[idx] -= taken;
    return taken;
  }

  /** @param {number} wx @param {number} wy @param {number} amount */
  depositWaste(wx, wy, amount) {
    const idx = this.gridIndex(wx, wy);
    this.waste[idx] += amount;
  }

  /**
   * Apply ecology flux deltas at a grid cell (E3 gene flux).
   * @param {number} wx @param {number} wy
   * @param {{ dCO2?: number, dO2?: number, dDOC?: number, dPOC?: number, dWaste?: number }} deltas
   */
  depositEcologyFlux(wx, wy, deltas) {
    if (!this.ecologyEnabled) return;
    const idx = this.gridIndex(wx, wy);

    if (deltas.dCO2 && this.CO2) {
      this.CO2[idx] = this._clampEcologyValue("CO2", this.CO2[idx] + deltas.dCO2);
    }
    if (deltas.dO2 && this.O2) {
      this.O2[idx] = this._clampEcologyValue("O2", this.O2[idx] + deltas.dO2);
    }
    if (deltas.dDOC && this.DOC) {
      this.DOC[idx] = this._clampEcologyValue("DOC", this.DOC[idx] + deltas.dDOC);
    }
    if (deltas.dPOC && this.POC) {
      this.POC[idx] = this._clampEcologyValue("POC", this.POC[idx] + deltas.dPOC);
    }
    if (deltas.dWaste) {
      this.waste[idx] = Math.max(0, this.waste[idx] + deltas.dWaste);
    }
  }

  /** @param {string} key @param {number} value */
  _clampEcologyValue(key, value) {
    const cfg = this[`${key}Cfg`];
    const max = cfg?.max ?? 1;
    if (!Number.isFinite(value)) return cfg?.baseline ?? 0;
    if (value < 0) return 0;
    if (value > max) return max;
    return value;
  }

  /** @param {number} wx @param {number} wy @param {number} radius */
  energyGradient(wx, wy, radius = 8) {
    const eRight = this.sampleEnergy(wx + radius, wy);
    const eLeft = this.sampleEnergy(wx - radius, wy);
    const eUp = this.sampleEnergy(wx, wy + radius);
    const eDown = this.sampleEnergy(wx, wy - radius);
    return {
      x: (eRight - eLeft) * 0.5,
      y: (eUp - eDown) * 0.5,
      center: this.sampleEnergy(wx, wy),
    };
  }

  /**
   * Monomer energy-gradient pull strength (what drives monomer drift along the field).
   * @param {number} wx @param {number} wy
   */
  driveStrength(wx, wy) {
    const g = this.energyGradient(wx, wy, 12);
    return Math.min(1, Math.hypot(g.x, g.y) * 10);
  }

  /**
   * @param {number} dt
   * @param {import('./particles.js').Particles} particles
   */
  step(dt, particles) {
    this._tick += 1;
    if (this._tick % this.updateStride !== 0) return;

    const effDt = dt * this.updateStride;
    this._diffuseField(this.energy, this._energyNext, this.energyCfg.diffusion, effDt);
    this._applyEnergySources(effDt);
    this._diffuseField(this.waste, this._wasteNext, this.wasteCfg.diffusion, effDt);
    this._applyWasteDecay(effDt);

    if (this.ecologyEnabled) {
      this._stepEcologyFields(effDt);
      this._equilibrateAtmosphere(effDt);
    }

    particles.applyFieldFeedback(this);
  }

  /** @param {number} dt */
  _stepEcologyFields(dt) {
    for (const key of this.ecologyKeys) {
      const field = this[key];
      const next = this[`_${key}Next`];
      const cfg = this[`${key}Cfg`];
      this._diffuseField(field, next, cfg.diffusion, dt);
      if (cfg.decay > 0) {
        for (let i = 0; i < field.length; i += 1) {
          field[i] -= dt * cfg.decay * field[i];
        }
      }
      for (let i = 0; i < field.length; i += 1) {
        field[i] = this._clampEcologyValue(key, field[i]);
      }
    }
  }

  /** @param {number} dt */
  _equilibrateAtmosphere(dt) {
    if (!this.CO2 && !this.O2) return;

    if (this.CO2) {
      const mean = this._fieldMean(this.CO2);
      this.globalCO2 += dt * this.atmosphereBiosphereFeedback * (mean - this.globalCO2);
      this.globalCO2 = clamp01(this.globalCO2);
      for (let i = 0; i < this.CO2.length; i += 1) {
        this.CO2[i] += dt * this.oceanEquilRate * (this.globalCO2 - this.CO2[i]);
        this.CO2[i] = this._clampEcologyValue("CO2", this.CO2[i]);
      }
    }

    if (this.O2) {
      const mean = this._fieldMean(this.O2);
      this.globalO2 += dt * this.atmosphereBiosphereFeedback * (mean - this.globalO2);
      this.globalO2 = clamp01(this.globalO2);
      for (let i = 0; i < this.O2.length; i += 1) {
        this.O2[i] += dt * this.oceanEquilRate * (this.globalO2 - this.O2[i]);
        this.O2[i] = this._clampEcologyValue("O2", this.O2[i]);
      }
    }
  }

  /** @param {Float32Array} field */
  _fieldMean(field) {
    let sum = 0;
    for (let i = 0; i < field.length; i += 1) sum += field[i];
    return sum / field.length;
  }

  /**
   * Smoke / headless validation.
   * @returns {{ ok: boolean, reason?: string }}
   */
  validateEcologyState() {
    if (!this.ecologyEnabled) return { ok: true };

    if (!Number.isFinite(this.globalCO2) || !Number.isFinite(this.globalO2)) {
      return { ok: false, reason: "global_atmosphere_nan" };
    }
    if (this.globalCO2 < 0 || this.globalCO2 > 1 || this.globalO2 < 0 || this.globalO2 > 1) {
      return { ok: false, reason: "global_atmosphere_bounds" };
    }

    for (const key of this.ecologyKeys) {
      const field = this[key];
      const max = this[`${key}Cfg`].max;
      for (let i = 0; i < field.length; i += 1) {
        if (!Number.isFinite(field[i])) return { ok: false, reason: `${key}_nan` };
        if (field[i] < 0 || field[i] > max) return { ok: false, reason: `${key}_bounds` };
      }
    }

    return { ok: true };
  }

  /** @param {number} dt */
  _applyEnergySources(dt) {
    const baseline = this.energyCfg.baseline;
    const replenish = this.energyCfg.replenish;
    for (let i = 0; i < this.energy.length; i += 1) {
      this.energy[i] += dt * replenish * (baseline - this.energy[i]);
      if (this.energy[i] < 0) this.energy[i] = 0;
      if (this.energy[i] > 1) this.energy[i] = 1;
    }
  }

  /** @param {number} dt */
  _applyWasteDecay(dt) {
    const decay = this.wasteCfg.decay;
    for (let i = 0; i < this.waste.length; i += 1) {
      this.waste[i] -= dt * decay * this.waste[i];
      if (this.waste[i] < 0) this.waste[i] = 0;
    }
  }

  /**
   * @param {Float32Array} src
   * @param {Float32Array} dst
   * @param {number} diffusion
   * @param {number} dt
   */
  _diffuseField(src, dst, diffusion, dt) {
    const w = this.gridW;
    const h = this.gridH;
    const coeff = diffusion * dt;

    for (let gy = 0; gy < h; gy += 1) {
      for (let gx = 0; gx < w; gx += 1) {
        const idx = gy * w + gx;
        const center = src[idx];
        const left = src[gy * w + ((gx - 1 + w) % w)];
        const right = src[gy * w + ((gx + 1) % w)];
        const down = src[(((gy - 1 + h) % h) * w) + gx];
        const up = src[(((gy + 1) % h) * w) + gx];
        const lap = left + right + down + up - 4 * center;
        dst[idx] = center + coeff * lap;
      }
    }

    src.set(dst);
  }

  /**
   * Draw field heatmap.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   * @param {string} mode
   */
  drawHeatmap(ctx, camera, mode = "energy") {
    const bounds = camera.getViewBounds();
    const tile = this.heatmapTileSize;
    const opacity = this.heatmapOpacity;
    const margin = tile * 2;

    const xShifts = this._wrapShifts(bounds.left, bounds.right, margin, this.worldWidth);
    const yShifts = this._wrapShifts(bounds.bottom, bounds.top, margin, this.worldHeight);

    for (const ox of xShifts) {
      for (const oy of yShifts) {
        const startX = Math.floor(bounds.left / tile) * tile;
        const endX = Math.ceil(bounds.right / tile) * tile;
        const startY = Math.floor(bounds.bottom / tile) * tile;
        const endY = Math.ceil(bounds.top / tile) * tile;

        for (let wx = startX; wx < endX; wx += tile) {
          for (let wy = startY; wy < endY; wy += tile) {
            const sampleX = wx + ox + tile * 0.5;
            const sampleY = wy + oy + tile * 0.5;
            const { r, g, b, v } = this._heatmapColor(mode, sampleX, sampleY);

            const a = opacity * (0.28 + v * 0.72);
            const drawX = wx + ox;
            const drawY = wy + oy;
            const tl = camera.worldToScreen(drawX, drawY + tile);
            const br = camera.worldToScreen(drawX + tile, drawY);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
          }
        }
      }
    }
  }

  /** @param {string} mode @param {number} sampleX @param {number} sampleY */
  _heatmapColor(mode, sampleX, sampleY) {
    let r = 20;
    let g = 40;
    let b = 60;
    let v = 0;

    if (mode === "energy") {
      v = this.sampleEnergy(sampleX, sampleY);
      r = 20 + v * 40;
      g = 40 + v * 120;
      b = 60 + v * 80;
    } else if (mode === "waste") {
      v = Math.min(1, this.sampleWaste(sampleX, sampleY) * 2.5);
      r = 80 + v * 140;
      g = 30 + v * 40;
      b = 90 + v * 50;
    } else if (mode === "CO2" && this.CO2) {
      const max = this.CO2Cfg.max;
      v = clamp01(this.sampleCO2(sampleX, sampleY) / max);
      r = 40 + v * 30;
      g = 70 + v * 50;
      b = 90 + v * 80;
    } else if (mode === "O2" && this.O2) {
      const max = this.O2Cfg.max;
      v = clamp01(this.sampleO2(sampleX, sampleY) / max);
      r = 30 + v * 40;
      g = 120 + v * 100;
      b = 200 + v * 40;
    } else if (mode === "DOC" && this.DOC) {
      const max = this.DOCCfg.max;
      v = clamp01(this.sampleDOC(sampleX, sampleY) / max);
      r = 60 + v * 120;
      g = 90 + v * 80;
      b = 40 + v * 30;
    } else if (mode === "drive") {
      v = this.driveStrength(sampleX, sampleY);
      r = 40 + v * 40;
      g = 60 + v * 160;
      b = 200 + v * 40;
    } else if (mode === "light" && this.earthProfile) {
      v = this.earthProfile.sampleLight(sampleX, sampleY);
      r = 180 + v * 75;
      g = 150 + v * 100;
      b = 40 + v * 30;
    } else if (this.ecologyKeys.includes(mode)) {
      v = clamp01(this.sampleEcology(mode, sampleX, sampleY));
      r = 100;
      g = 100;
      b = 100;
    }

    return { r: Math.floor(r), g: Math.floor(g), b: Math.floor(b), v };
  }

  /**
   * @param {number} low @param {number} high @param {number} margin @param {number} size
   */
  _wrapShifts(low, high, margin, size) {
    const shifts = [0];
    if (low < margin) shifts.push(size);
    if (high > size - margin) shifts.push(-size);
    return shifts;
  }

  /** @param {Float32Array} field @param {number} wx @param {number} wy */
  _bilinearSample(field, wx, wy) {
    const x = wrapCoord(wx, this.worldWidth) / this.cellW - 0.5;
    const y = wrapCoord(wy, this.worldHeight) / this.cellH - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;

    const x1 = (x0 + 1) % this.gridW;
    const y1 = (y0 + 1) % this.gridH;
    const x0w = ((x0 % this.gridW) + this.gridW) % this.gridW;
    const y0w = ((y0 % this.gridH) + this.gridH) % this.gridH;

    const v00 = field[y0w * this.gridW + x0w];
    const v10 = field[y0w * this.gridW + x1];
    const v01 = field[y1 * this.gridW + x0w];
    const v11 = field[y1 * this.gridW + x1];

    const top = v00 + fx * (v10 - v00);
    const bottom = v01 + fx * (v11 - v01);
    return top + fy * (bottom - top);
  }
}

/** @param {number} v */
function clamp01(v) {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}
