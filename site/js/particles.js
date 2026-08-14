import { wrapCoord, wrapDelta } from "./camera.js";

const TYPE = {
  MONOMER: "monomer",
  CATALYST: "catalyst",
  DIMER: "dimer",
};

const COLORS = {
  [TYPE.MONOMER]: "#7ec8e8",
  [TYPE.CATALYST]: "#e8b44d",
  [TYPE.DIMER]: "#3d7ab8",
};

/**
 * Pre-biological substrate particles (no template replication).
 */
export class Particles {
  /**
   * @param {object} preset
   * @param {number} worldWidth
   * @param {number} worldHeight
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  constructor(preset, worldWidth, worldHeight, rng) {
    this.preset = preset;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.maxCount = preset.particles.maxCount;
    this.cfg = preset.particles;
    this.list = [];

    this._spawnInitial(rng);
  }

  /** @param {ReturnType<import('./camera.js').createRng>} rng */
  _spawnInitial(rng) {
    const counts = this.cfg.counts;
    for (const type of [TYPE.MONOMER, TYPE.CATALYST, TYPE.DIMER]) {
      const n = counts[type] ?? 0;
      for (let i = 0; i < n; i += 1) {
        this.list.push(this._createParticle(type, rng.range(0, this.worldWidth), rng.range(0, this.worldHeight), rng));
      }
    }
  }

  /**
   * @param {string} type
   * @param {number} x
   * @param {number} y
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  _createParticle(type, x, y, rng) {
    const speed = type === TYPE.CATALYST ? 2 : 8;
    const angle = rng.range(0, Math.PI * 2);
    return {
      id: `${type}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      energy: 0.6 + rng.next() * 0.3,
      age: 0,
    };
  }

  count() {
    return this.list.length;
  }

  typeCountsSnapshot() {
    const counts = { monomer: 0, catalyst: 0, dimer: 0 };
    for (const p of this.list) {
      counts[p.type] += 1;
    }
    return counts;
  }

  /**
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  step(dt, fields, rng) {
    const events = {
      dimersCreated: 0,
      dimersCreatedNearCatalyst: 0,
      dimersDissociated: 0,
    };

    const monomers = [];
    const catalysts = [];
    const dimers = [];

    for (const p of this.list) {
      if (p.type === TYPE.MONOMER) monomers.push(p);
      else if (p.type === TYPE.CATALYST) catalysts.push(p);
      else dimers.push(p);
    }

    this._integrateMotion(dt, fields, rng);
    this._metabolism(dt, fields);
    this._catalysis(monomers, catalysts, rng, events);
    this._dissociation(dimers, rng, events);
    this._cullDead();

    for (const p of this.list) {
      p.age += 1;
    }

    return events;
  }

  /** @param {import('./fields.js').Fields} fields */
  applyFieldFeedback(fields) {
    // Reserved hook: particles already deposit/consume during metabolism step.
    void fields;
  }

  /**
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  _integrateMotion(dt, fields, rng) {
    for (const p of this.list) {
      const cfg = this.cfg[p.type];
      let ax = 0;
      let ay = 0;

      if (p.type === TYPE.MONOMER) {
        const grad = fields.energyGradient(p.x, p.y, 12);
        const gMag = Math.hypot(grad.x, grad.y) + 1e-6;
        ax += (grad.x / gMag) * cfg.energyBias * cfg.mobility;
        ay += (grad.y / gMag) * cfg.energyBias * cfg.mobility;
      }

      const noise = cfg.mobility * 0.35;
      ax += (rng.next() - 0.5) * noise;
      ay += (rng.next() - 0.5) * noise;

      const waste = fields.sampleWaste(p.x, p.y);
      const drag = 1 + waste * 2.5;
      p.vx = (p.vx + ax * dt) / drag;
      p.vy = (p.vy + ay * dt) / drag;

      const maxSpeed = cfg.mobility;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.x = wrapCoord(p.x + p.vx * dt, this.worldWidth);
      p.y = wrapCoord(p.y + p.vy * dt, this.worldHeight);
    }
  }

  /**
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   */
  _metabolism(dt, fields) {
    for (const p of this.list) {
      const cfg = this.cfg[p.type];
      const fieldEnergy = fields.sampleEnergy(p.x, p.y);
      const uptake = Math.min(fieldEnergy, cfg.metabolismCost * dt * 3);
      fields.consumeEnergy(p.x, p.y, uptake);
      p.energy += uptake - cfg.metabolismCost * dt;

      const wasteRate = cfg.wasteEmit ?? cfg.metabolismCost * 0.5;
      fields.depositWaste(p.x, p.y, wasteRate * dt);
    }
  }

  /**
   * @param {object[]} monomers
   * @param {object[]} catalysts
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {{ dimersCreated: number, dimersCreatedNearCatalyst: number }} events
   */
  _catalysis(monomers, catalysts, rng, events) {
    if (this.list.length >= this.maxCount) return;

    const radius = this.cfg.catalyst.catalysisRadius;
    const rate = this.cfg.catalyst.pairingRate;

    for (const cat of catalysts) {
      const nearby = [];
      for (const m of monomers) {
        if (m._paired) continue;
        const dx = wrapDelta(cat.x, m.x, this.worldWidth);
        const dy = wrapDelta(cat.y, m.y, this.worldHeight);
        if (dx * dx + dy * dy <= radius * radius) {
          nearby.push(m);
        }
      }

      if (nearby.length < 2) continue;

      for (let i = 0; i < nearby.length - 1 && this.list.length < this.maxCount; i += 1) {
        const a = nearby[i];
        if (a._paired) continue;
        for (let j = i + 1; j < nearby.length && this.list.length < this.maxCount; j += 1) {
          const b = nearby[j];
          if (b._paired) continue;
          if (rng.next() > rate * 0.02) continue;

          a._paired = true;
          b._paired = true;

          const dimer = {
            id: `dimer-${Math.random().toString(36).slice(2, 9)}`,
            type: TYPE.DIMER,
            x: wrapCoord((a.x + b.x) * 0.5, this.worldWidth),
            y: wrapCoord((a.y + b.y) * 0.5, this.worldHeight),
            vx: (a.vx + b.vx) * 0.5,
            vy: (a.vy + b.vy) * 0.5,
            energy: (a.energy + b.energy) * 0.5,
            age: 0,
          };

          this.list.push(dimer);
          a._remove = true;
          b._remove = true;
          events.dimersCreated += 1;
          events.dimersCreatedNearCatalyst += 1;
          break;
        }
      }
    }

    this._removeFlagged(monomers);
  }

  /**
   * @param {object[]} dimers
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {{ dimersDissociated: number }} events
   */
  _dissociation(dimers, rng, events) {
    if (this.list.length + 2 > this.maxCount) return;

    const rate = this.cfg.dimer.dissociationRate;
    for (const d of dimers) {
      if (rng.next() > rate * 0.015) continue;
      if (this.list.length + 2 > this.maxCount) break;

      d._remove = true;
      events.dimersDissociated += 1;

      const offset = 4;
      this.list.push(this._createParticle(TYPE.MONOMER, wrapCoord(d.x - offset, this.worldWidth), wrapCoord(d.y, this.worldHeight), rng));
      this.list.push(this._createParticle(TYPE.MONOMER, wrapCoord(d.x + offset, this.worldWidth), wrapCoord(d.y, this.worldHeight), rng));
    }

    this._removeFlagged(dimers);
  }

  /** @param {object[]} subset */
  _removeFlagged(subset) {
    for (const p of subset) {
      p._paired = false;
    }
    this.list = this.list.filter((p) => !p._remove);
    for (const p of this.list) {
      p._remove = false;
      p._paired = false;
    }
  }

  _cullDead() {
    this.list = this.list.filter((p) => p.energy > 0.02);
  }

  /**
   * Draw particles visible in the viewport (with wrap copies).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   */
  draw(ctx, camera) {
    const bounds = camera.getViewBounds();
    const margin = 20;
    const left = bounds.left - margin;
    const right = bounds.right + margin;
    const bottom = bounds.bottom - margin;
    const top = bounds.top + margin;

    for (const p of this.list) {
      const cfg = this.cfg[p.type];
      const radius = cfg.radius;
      const copies = this._wrapOffsets(p.x, p.y, left, right, bottom, top);
      ctx.fillStyle = COLORS[p.type];

      for (const [ox, oy] of copies) {
        const screen = camera.worldToScreen(p.x + ox, p.y + oy);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} left
   * @param {number} right
   * @param {number} bottom
   * @param {number} top
   */
  _wrapOffsets(x, y, left, right, bottom, top) {
    const offsets = [[0, 0]];
    const w = this.worldWidth;
    const h = this.worldHeight;

    const xShifts = [0];
    const yShifts = [0];
    if (x < left) xShifts.push(w);
    if (x > right) xShifts.push(-w);
    if (y < bottom) yShifts.push(h);
    if (y > top) yShifts.push(-h);

    for (const ox of xShifts) {
      for (const oy of yShifts) {
        if (ox === 0 && oy === 0) continue;
        offsets.push([ox, oy]);
      }
    }
    return offsets;
  }

  /**
   * Collect dimers for metrics.
   * @returns {{ x: number, y: number }[]}
   */
  dimerPositions() {
    const out = [];
    for (const p of this.list) {
      if (p.type === TYPE.DIMER) out.push(p);
    }
    return out;
  }

  catalystPositions() {
    const out = [];
    for (const p of this.list) {
      if (p.type === TYPE.CATALYST) out.push(p);
    }
    return out;
  }
}

export { TYPE as ParticleType };
