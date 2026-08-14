import { wrapCoord } from "./camera.js";

/**
 * Scalar fields on a coarse grid with wrap diffusion.
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
  }

  /** @param {number} wx @param {number} wy */
  worldToGrid(wx, wy) {
    const gx = Math.min(this.gridW - 1, Math.max(0, Math.floor(wrapCoord(wx, this.worldWidth) / this.cellW)));
    const gy = Math.min(this.gridH - 1, Math.max(0, Math.floor(wrapCoord(wy, this.worldHeight) / this.cellH)));
    return { gx, gy };
  }

  /** @param {number} wx @param {number} wy */
  sampleEnergy(wx, wy) {
    return this._bilinearSample(this.energy, wx, wy);
  }

  /** @param {number} wx @param {number} wy */
  sampleWaste(wx, wy) {
    return this._bilinearSample(this.waste, wx, wy);
  }

  /** @param {number} wx @param {number} wy @param {number} amount */
  consumeEnergy(wx, wy, amount) {
    const { gx, gy } = this.worldToGrid(wx, wy);
    const idx = gy * this.gridW + gx;
    const taken = Math.min(this.energy[idx], amount);
    this.energy[idx] -= taken;
    return taken;
  }

  /** @param {number} wx @param {number} wy @param {number} amount */
  depositWaste(wx, wy, amount) {
    const { gx, gy } = this.worldToGrid(wx, wy);
    const idx = gy * this.gridW + gx;
    this.waste[idx] += amount;
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
    particles.applyFieldFeedback(this);
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
   * Draw energy heatmap for the visible viewport only.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   */
  drawHeatmap(ctx, camera) {
    const bounds = camera.getViewBounds();
    const tile = this.heatmapTileSize;
    const opacity = this.heatmapOpacity;

    const startX = Math.floor(bounds.left / tile) * tile;
    const endX = Math.ceil(bounds.right / tile) * tile;
    const startY = Math.floor(bounds.bottom / tile) * tile;
    const endY = Math.ceil(bounds.top / tile) * tile;

    for (let wx = startX; wx < endX; wx += tile) {
      for (let wy = startY; wy < endY; wy += tile) {
        const e = this.sampleEnergy(wx + tile * 0.5, wy + tile * 0.5);
        const r = 20 + e * 40;
        const g = 40 + e * 120;
        const b = 60 + e * 80;
        const a = opacity * (0.35 + e * 0.65);

        const tl = camera.worldToScreen(wx, wy + tile);
        const br = camera.worldToScreen(wx + tile, wy);
        ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }
    }
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
