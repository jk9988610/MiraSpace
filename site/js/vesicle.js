import { wrapCoord, wrapDelta } from "./camera.js";

const MEMBRANE_COLOR = "rgba(120, 200, 255, 0.35)";
const MEMBRANE_STROKE = "rgba(160, 220, 255, 0.75)";

/**
 * Vesicle compartments: emergent nucleation, strand capture, growth, fission, lysis.
 * No script spawn — nucleationRate-driven only.
 */
export class Vesicle {
  /**
   * @param {object} preset
   * @param {number} worldWidth
   * @param {number} worldHeight
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {import('./chemoton.js').Chemoton | null} [chemoton]
   */
  constructor(preset, worldWidth, worldHeight, rng, chemoton = null) {
    this.cfg = preset.vesicle;
    this.chemoton = chemoton;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.list = [];
    this._nextId = 1;
    this._nextLineageId = 1;
    this._nextCompartmentId = 1;
    this._totalFissions = 0;

    void rng;
  }

  count() {
    return this.list.length;
  }

  /** @param {string} id */
  byId(id) {
    return this.list.find((v) => v.id === id) ?? null;
  }

  interiorStrandCount(replicator) {
    let n = 0;
    for (const s of replicator.list) {
      if (s.vesicleId) n += 1;
    }
    return n;
  }

  /**
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {import('./particles.js').Particles} particles
   * @param {import('./replicator.js').Replicator} replicator
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {number} simTime
   * @param {object | null} [replicatorEvents]
   */
  step(dt, fields, particles, replicator, rng, simTime, replicatorEvents = null) {
    const events = {
      nucleations: 0,
      captures: 0,
      fissions: 0,
      lyses: 0,
      fissionEvents: 0,
    };

    this._tryNucleation(fields, particles, replicator, rng, events, simTime);
    this._updateCapture(replicator, dt, events);
    this._constrainInteriorStrands(replicator);

    const toRemove = [];
    for (const v of this.list) {
      v.age += 1;
      this._maintainAndGrow(v, dt, fields, particles);
      if (this.chemoton) {
        this.chemoton.updateGeneticAndCoherence(v, replicator, simTime, dt);
        if (replicatorEvents?.replications && v.interior.size > 0) {
          void replicatorEvents;
        }
      }
      if (v._pendingLysis) {
        toRemove.push(v.id);
        continue;
      }
      this._tryFission(v, replicator, rng, events, simTime);
    }

    for (const id of toRemove) {
      this._lysis(this.byId(id), replicator, events);
    }

    return events;
  }

  /**
   * @param {import('./fields.js').Fields} fields
   * @param {import('./particles.js').Particles} particles
   * @param {import('./replicator.js').Replicator} replicator
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {{ nucleations: number }} events
   * @param {number} simTime
   */
  _tryNucleation(fields, particles, replicator, rng, events, simTime) {
    if (this.list.length >= this.cfg.maxCount) return;

    const energyMin = this.cfg.nucleationEnergyMin ?? 0.32;
    const catalysts = particles.catalystPositions();
    const strandBoostR = this.cfg.nucleationStrandRadius ?? 96;
    const strandBoostR2 = strandBoostR * strandBoostR;
    const baseRate = this.cfg.nucleationRate;

    for (const cat of catalysts) {
      let rate = baseRate;
      for (const strand of replicator.list) {
        if (strand.vesicleId) continue;
        const dx = wrapDelta(strand.x, cat.x, this.worldWidth);
        const dy = wrapDelta(strand.y, cat.y, this.worldHeight);
        if (dx * dx + dy * dy <= strandBoostR2) {
          rate = baseRate * (this.cfg.nucleationStrandBoost ?? 12);
          break;
        }
      }
      if (rng.next() >= rate) continue;
      if (fields.sampleEnergy(cat.x, cat.y) < energyMin) continue;

      const v = this._createVesicle(cat.x, cat.y, this.cfg.radius0, rng, simTime);
      this._primeCaptureNear(v, replicator);
      this.list.push(v);
      events.nucleations += 1;
      if (this.list.length >= this.cfg.maxCount) break;
    }
  }

  /**
   * @param {object} v
   * @param {import('./replicator.js').Replicator} replicator
   */
  _primeCaptureNear(v, replicator) {
    const margin = this.cfg.captureMargin ?? 2;
    const required = this.cfg.captureTicks ?? 4;
    const primeR = v.radius + (this.cfg.nucleationStrandRadius ?? 96) * 0.35;
    const primeR2 = primeR * primeR;

    for (const strand of replicator.list) {
      if (strand.vesicleId) continue;
      const dx = wrapDelta(strand.x, v.x, this.worldWidth);
      const dy = wrapDelta(strand.y, v.y, this.worldHeight);
      const dist2 = dx * dx + dy * dy;
      if (dist2 > primeR2) continue;

      if (dist2 <= (v.radius - margin) ** 2) {
        strand._captureProgress = { vesicleId: v.id, ticks: required };
      } else if (dist2 <= (v.radius + 8) ** 2) {
        strand._captureProgress = { vesicleId: v.id, ticks: required - 1 };
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {number} [simTime]
   */
  _createVesicle(x, y, radius, rng, simTime = 0) {
    const id = this._nextId;
    this._nextId += 1;
    const lineageId = this._nextLineageId;
    this._nextLineageId += 1;
    const compartmentId = this._nextCompartmentId;
    this._nextCompartmentId += 1;
    const v = {
      id: `vesicle-${id}`,
      x: wrapCoord(x, this.worldWidth),
      y: wrapCoord(y, this.worldHeight),
      radius,
      membraneEnergy: 0.45 + rng.next() * 0.35,
      age: 0,
      compartmentId,
      lineageId,
      interior: new Set(),
      localPool: 0,
    };
    if (this.chemoton) {
      v.chemoton = this.chemoton.createState(rng);
      this.chemoton.registerBirth(v, simTime);
    }
    return v;
  }

  /**
   * @param {import('./replicator.js').Replicator} replicator
   * @param {number} dt
   * @param {{ captures: number }} events
   */
  _updateCapture(replicator, dt, events) {
    const margin = this.cfg.captureMargin ?? 4;
    const required = this.cfg.captureTicks ?? 15;

    for (const strand of replicator.list) {
      if (strand.vesicleId) continue;

      let best = null;
      let bestDist = Infinity;

      for (const v of this.list) {
        const dx = wrapDelta(strand.x, v.x, this.worldWidth);
        const dy = wrapDelta(strand.y, v.y, this.worldHeight);
        const dist = Math.hypot(dx, dy);
        const inner = v.radius - margin;
        if (dist < inner && dist < bestDist) {
          best = v;
          bestDist = dist;
        }
      }

      if (!best) {
        strand._captureProgress = null;
        continue;
      }

      if (!strand._captureProgress || strand._captureProgress.vesicleId !== best.id) {
        strand._captureProgress = { vesicleId: best.id, ticks: 1 };
      } else {
        strand._captureProgress.ticks += 1;
      }

      const dx = wrapDelta(strand.x, best.x, this.worldWidth);
      const dy = wrapDelta(strand.y, best.y, this.worldHeight);
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) {
        const pull = 0.1;
        strand.x = wrapCoord(strand.x + (dx / dist) * pull, this.worldWidth);
        strand.y = wrapCoord(strand.y + (dy / dist) * pull, this.worldHeight);
      }

      if (strand._captureProgress.ticks >= required) {
        strand.vesicleId = best.id;
        best.interior.add(strand.id);
        strand._captureProgress = null;
        events.captures += 1;
      }
    }

    void dt;
  }

  /** @param {import('./replicator.js').Replicator} replicator */
  _constrainInteriorStrands(replicator) {
    const margin = this.cfg.captureMargin ?? 4;
    const strandR = replicator.cfg.radius ?? 4;

    for (const strand of replicator.list) {
      if (!strand.vesicleId) continue;
      const v = this.byId(strand.vesicleId);
      if (!v) {
        strand.vesicleId = null;
        continue;
      }

      const dx = wrapDelta(strand.x, v.x, this.worldWidth);
      const dy = wrapDelta(strand.y, v.y, this.worldHeight);
      const dist = Math.hypot(dx, dy);
      const maxDist = Math.max(strandR, v.radius - margin - strandR);
      if (dist > maxDist && dist > 1e-6) {
        const scale = maxDist / dist;
        strand.x = wrapCoord(v.x + dx * scale, this.worldWidth);
        strand.y = wrapCoord(v.y + dy * scale, this.worldHeight);
      }

      const permeability = this.cfg.permeability ?? 0.3;
      const retention = 1 - permeability;
      strand.energy += retention * 0.012;
    }
  }

  /**
   * @param {object} v
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {import('./particles.js').Particles} particles
   */
  _maintainAndGrow(v, dt, fields, particles) {
    const energy = fields.sampleEnergy(v.x, v.y);
    const uptake = Math.min(energy, 0.08) * dt * 3;
    fields.consumeEnergy(v.x, v.y, uptake);
    v.membraneEnergy += uptake;
    v.localPool += uptake * (1 - (this.cfg.permeability ?? 0.3));

    v.membraneEnergy -= this.cfg.maintenanceCost * dt;

    if (this.chemoton) {
      if (v.chemoton?.membraneHealth <= 0) {
        v._pendingLysis = true;
        return;
      }
    } else if (v.membraneEnergy <= 0) {
      v._pendingLysis = true;
      return;
    }

    if (v.radius >= this.cfg.radiusMax) return;

    const monomers = this._countMonomersNear(v, particles);
    const monomerFactor = Math.max(0.2, Math.min(monomers, 8) / 4);
    if (v.membraneEnergy < this.cfg.maintenanceCost * 1.5) return;

    const growth = this.cfg.growthRate * dt * monomerFactor;
    v.radius = Math.min(this.cfg.radiusMax, v.radius + growth);
    v.membraneEnergy -= this.cfg.maintenanceCost * 0.35 * dt;
  }

  /**
   * @param {object} v
   * @param {import('./particles.js').Particles} particles
   */
  _countMonomersNear(v, particles) {
    let count = 0;
    const r = v.radius + (this.cfg.monomerSearchRadius ?? 24);
    const r2 = r * r;
    for (const p of particles.list) {
      if (p.type !== "monomer") continue;
      const dx = wrapDelta(v.x, p.x, this.worldWidth);
      const dy = wrapDelta(v.y, p.y, this.worldHeight);
      if (dx * dx + dy * dy <= r2) count += 1;
    }
    return count;
  }

  /**
   * @param {object} v
   * @param {import('./replicator.js').Replicator} replicator
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {{ fissions: number, fissionEvents: number }} events
   * @param {number} simTime
   */
  _tryFission(v, replicator, rng, events, simTime) {
    const threshold = (this.cfg.fissionThresholdRatio ?? 0.9) * this.cfg.radiusMax;
    if (v.radius < threshold) return;

    if (this.chemoton && !this.chemoton.canFission(v, threshold)) return;

    if (v.membraneEnergy < this.cfg.maintenanceCost * 8) {
      v._pendingLysis = true;
      return;
    }

    if (this.list.length + 1 >= this.cfg.maxCount) return;

    const newRadius = v.radius * 0.7;
    const sep = newRadius * 1.15;
    const angle = rng.range(0, Math.PI * 2);
    const ox = Math.cos(angle) * sep;
    const oy = Math.sin(angle) * sep;

    const childA = this._createVesicle(
      wrapCoord(v.x - ox, this.worldWidth),
      wrapCoord(v.y - oy, this.worldHeight),
      newRadius,
      rng,
      simTime,
    );
    const childB = this._createVesicle(
      wrapCoord(v.x + ox, this.worldWidth),
      wrapCoord(v.y + oy, this.worldHeight),
      newRadius,
      rng,
      simTime,
    );
    childA.lineageId = v.lineageId;
    childB.lineageId = v.lineageId;
    childA.membraneEnergy = v.membraneEnergy * 0.45;
    childB.membraneEnergy = v.membraneEnergy * 0.45;

    if (this.chemoton && v.chemoton) {
      childA.chemoton = this.chemoton.inheritState(v, rng);
      childB.chemoton = this.chemoton.inheritState(v, rng);
    }

    const interiorIds = [...v.interior];
    for (const sid of interiorIds) {
      const toA = rng.next() < 0.5;
      const target = toA ? childA : childB;
      target.interior.add(sid);
      const strand = replicator.list.find((s) => s.id === sid);
      if (strand) {
        strand.vesicleId = target.id;
        const jitter = 3;
        strand.x = wrapCoord(target.x + (rng.next() - 0.5) * jitter, this.worldWidth);
        strand.y = wrapCoord(target.y + (rng.next() - 0.5) * jitter, this.worldHeight);
      }
    }

    this.list.push(childA, childB);
    v.interior.clear();
    this.list = this.list.filter((item) => item.id !== v.id);

    events.fissions += 1;
    events.fissionEvents += 1;
    this._totalFissions += 1;
  }

  /**
   * @param {object | null} v
   * @param {import('./replicator.js').Replicator} replicator
   * @param {{ lyses: number }} events
   */
  _lysis(v, replicator, events) {
    if (!v) return;

    if (this.chemoton) {
      this.chemoton.registerDeath(v, v.age);
    }

    for (const sid of v.interior) {
      const strand = replicator.list.find((s) => s.id === sid);
      if (strand) {
        strand.vesicleId = null;
        strand._captureProgress = null;
      }
    }

    this.list = this.list.filter((item) => item.id !== v.id);
    events.lyses += 1;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   * @param {import('./replicator.js').Replicator} replicator
   */
  draw(ctx, camera, replicator) {
    const bounds = camera.getViewBounds();
    const margin = 48;

    for (const v of this.list) {
      const copies = this._wrapOffsets(v.x, v.y, v.radius, bounds, margin);
      for (const [ox, oy] of copies) {
        const screen = camera.worldToScreen(v.x + ox, v.y + oy);
        const r = v.radius * camera.scale;

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        if (v.chemoton) {
          const flux = v.chemoton.metabolicFlux;
          ctx.fillStyle = `rgba(${80 + flux * 80}, ${160 + flux * 60}, 255, 0.32)`;
        } else {
          ctx.fillStyle = MEMBRANE_COLOR;
        }
        ctx.fill();
        ctx.strokeStyle = MEMBRANE_STROKE;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (const sid of v.interior) {
          const strand = replicator.list.find((s) => s.id === sid);
          if (!strand) continue;
          const sdx = wrapDelta(strand.x, v.x, this.worldWidth);
          const sdy = wrapDelta(strand.y, v.y, this.worldHeight);
          const sp = camera.worldToScreen(v.x + ox + sdx, v.y + oy + sdy);
          const hue = (strand.lineageId * 47) % 360;
          ctx.fillStyle = `hsla(${hue}, 75%, 68%, 0.9)`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, Math.max(2, replicator.cfg.radius * camera.scale * 0.85), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _wrapOffsets(x, y, radius, bounds, margin) {
    const left = bounds.left - margin - radius;
    const right = bounds.right + margin + radius;
    const bottom = bounds.bottom - margin - radius;
    const top = bounds.top + margin + radius;
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
}
