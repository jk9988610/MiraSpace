import { wrapCoord, wrapDelta } from "./camera.js";
import { randomNucleationSequence } from "./gene-expression.js";

const STRAND_COLOR = "#c77dff";

/**
 * General replicator strands: nucleation, template copy, mutation.
 * No dimer upgrade; initialCount must be 0 (emergent nucleation only).
 */
export class Replicator {
  /**
   * @param {object} preset
   * @param {number} worldWidth
   * @param {number} worldHeight
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  constructor(preset, worldWidth, worldHeight, rng) {
    this.cfg = preset.replicator;
    this.preset = preset;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.list = [];
    this._nextId = 1;
    this._nextLineageId = 1;
    this._L0Sum = 0;
    this._L0Count = 0;

    if ((this.cfg.initialCount ?? 0) !== 0) {
      throw new Error("replicator.initialCount must be 0 (no script spawn)");
    }

    void rng;
  }

  count() {
    return this.list.length;
  }

  meanLength() {
    if (this.list.length === 0) return 0;
    let sum = 0;
    for (const s of this.list) sum += s.sequence.length;
    return sum / this.list.length;
  }

  L0Baseline() {
    if (this._L0Count > 0) return this._L0Sum / this._L0Count;
    return (this.cfg.L0Min + this.cfg.L0Max) * 0.5;
  }

  /**
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {import('./particles.js').Particles} particles
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {import('./vesicle.js').Vesicle | null} [vesicle]
   * @param {import('./chemoton.js').Chemoton | null} [chemoton]
   * @param {number} [simTime]
   */
  step(dt, fields, particles, rng, vesicle = null, chemoton = null, simTime = 0) {
    const events = {
      nucleations: 0,
      replications: 0,
      deaths: 0,
      replicationPairs: [],
      lineageCounts: new Map(),
      fitnessByLineage: new Map(),
    };

    this._tryNucleation(fields, particles, rng, events);
    this._integrate(dt, fields, rng, vesicle);

    for (const strand of [...this.list]) {
      if (strand.energy <= 0) {
        this._remove(strand);
        events.deaths += 1;
        continue;
      }

      if (this.list.length >= this.cfg.maxPopulation) continue;
      const replicated = this._tryReplication(
        strand, dt, fields, particles, rng, events, vesicle, chemoton, simTime,
      );
      if (replicated) events.replications += 1;
    }

    for (const strand of this.list) {
      strand.age += 1;
      strand.replicationAttempts += 1;
      const count = events.lineageCounts.get(strand.lineageId) ?? 0;
      events.lineageCounts.set(strand.lineageId, count + 1);
      const fitness = (strand.replicationSuccesses / Math.max(1, strand.age))
        * Math.min(1, strand.energy)
        * (1 - this.cfg.maintenanceCost);
      const prev = events.fitnessByLineage.get(strand.lineageId) ?? [];
      prev.push(fitness);
      events.fitnessByLineage.set(strand.lineageId, prev);
    }

    return events;
  }

  /**
   * @param {import('./fields.js').Fields} fields
   * @param {import('./particles.js').Particles} particles
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {{ nucleations: number }} events
   */
  _tryNucleation(fields, particles, rng, events) {
    if (this.list.length >= this.cfg.maxPopulation) return;

    const catalysts = particles.catalystPositions();
    const dimers = particles.dimerPositions();

    for (const cat of catalysts) {
      if (rng.next() >= this.cfg.nucleationRate) continue;
      if (fields.sampleEnergy(cat.x, cat.y) < this.cfg.nucleationEnergyMin) continue;

      let dimerNear = false;
      const r = this.cfg.nucleationRadius;
      const r2 = r * r;
      for (const d of dimers) {
        const dx = wrapDelta(cat.x, d.x, this.worldWidth);
        const dy = wrapDelta(cat.y, d.y, this.worldHeight);
        if (dx * dx + dy * dy <= r2) {
          dimerNear = true;
          break;
        }
      }
      if (!dimerNear) continue;

      const length = this.cfg.L0Min + rng.int(this.cfg.L0Max - this.cfg.L0Min + 1);
      const profiles = this.preset.geneExpression?.nucleationProfiles;
      const sequence = profiles?.length
        ? randomNucleationSequence(rng, length, profiles)
        : this._randomSequence(length, rng);
      this.list.push(this._createStrand(sequence, cat.x, cat.y, rng, null, null));
      this._L0Sum += length;
      this._L0Count += 1;
      events.nucleations += 1;
      if (this.list.length >= this.cfg.maxPopulation) break;
    }
  }

  /**
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {import('./vesicle.js').Vesicle | null} [vesicle]
   */
  _integrate(dt, fields, rng, vesicle = null) {
    for (const strand of this.list) {
      let maintMult = 1;
      if (strand.vesicleId && vesicle) {
        const v = vesicle.byId(strand.vesicleId);
        if (v?.chemoton?.storageMode === "redundant") maintMult = 1.2;
      }
      const uptake = Math.min(fields.sampleEnergy(strand.x, strand.y), 0.06) * dt * 2.5;
      fields.consumeEnergy(strand.x, strand.y, uptake);
      strand.energy += uptake - this.cfg.maintenanceCost * dt * maintMult;

      const noise = this.cfg.mobility * 0.25;
      strand.vx = (strand.vx + (rng.next() - 0.5) * noise * dt) * 0.98;
      strand.vy = (strand.vy + (rng.next() - 0.5) * noise * dt) * 0.98;
      const speed = Math.hypot(strand.vx, strand.vy);
      if (speed > this.cfg.mobility) {
        strand.vx = (strand.vx / speed) * this.cfg.mobility;
        strand.vy = (strand.vy / speed) * this.cfg.mobility;
      }
      strand.x = wrapCoord(strand.x + strand.vx * dt, this.worldWidth);
      strand.y = wrapCoord(strand.y + strand.vy * dt, this.worldHeight);
    }
  }

  /**
   * @param {object} parent
   * @param {number} dt
   * @param {import('./fields.js').Fields} fields
   * @param {import('./particles.js').Particles} particles
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {{ replicationPairs: object[] }} events
   * @param {import('./vesicle.js').Vesicle | null} vesicle
   * @param {import('./chemoton.js').Chemoton | null} chemoton
   * @param {number} simTime
   */
  _tryReplication(parent, dt, fields, particles, rng, events, vesicle, chemoton, simTime) {
    const monomers = this._countMonomersNear(parent, particles);
    if (monomers < this.cfg.monomersRequired) return false;
    if (parent.energy < this.cfg.replicationCost) return false;

    let rate = this.cfg.replicationRateBase;
    rate *= 1 + this._motifBonus(parent.sequence);
    rate *= Math.min(1.2, fields.sampleEnergy(parent.x, parent.y) + 0.2);

    let parentVesicle = null;
    if (parent.vesicleId && vesicle && chemoton) {
      parentVesicle = vesicle.byId(parent.vesicleId);
      if (parentVesicle) {
        rate *= chemoton.replicationMultiplier(parentVesicle);
      }
    }

    const roll = rng.next();
    const success = roll < rate * dt;
    if (parentVesicle && chemoton) {
      chemoton.logReplication(parentVesicle, simTime, success);
    }
    if (!success) return false;

    parent.energy -= this.cfg.replicationCost;
    const childSeq = this._mutateSequence(parent.sequence, rng, parentVesicle);
    const offset = 6;
    const child = this._createStrand(
      childSeq,
      wrapCoord(parent.x + (rng.next() - 0.5) * offset, this.worldWidth),
      wrapCoord(parent.y + (rng.next() - 0.5) * offset, this.worldHeight),
      rng,
      parent.lineageId,
      parent.vesicleId ?? null,
    );
    child.energy = parent.energy * 0.45;
    this.list.push(child);
    parent.replicationSuccesses += 1;

    events.replicationPairs.push({
      parentSeq: parent.sequence,
      childSeq,
      length: parent.sequence.length,
    });
    return true;
  }

  /**
   * @param {object} strand
   * @param {import('./particles.js').Particles} particles
   */
  _countMonomersNear(strand, particles) {
    let count = 0;
    const r = this.cfg.replicationRadius;
    const r2 = r * r;
    for (const p of particles.list) {
      if (p.type !== "monomer") continue;
      const dx = wrapDelta(strand.x, p.x, this.worldWidth);
      const dy = wrapDelta(strand.y, p.y, this.worldHeight);
      if (dx * dx + dy * dy <= r2) count += 1;
    }
    return count;
  }

  /**
   * @param {number[]} sequence
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {object | null} [parentVesicle]
   */
  _mutateSequence(sequence, rng, parentVesicle = null) {
    const out = sequence.slice();
    let rate = this.cfg.mutationRate;
    if (parentVesicle?.chemoton?.storageMode === "redundant") {
      rate *= 0.5;
    }
    for (let i = 0; i < out.length; i += 1) {
      if (rng.next() < rate) out[i] = out[i] === 0 ? 1 : 0;
    }
    if (out.length < this.cfg.maxLength && rng.next() < rate * 0.35) {
      out.push(rng.int(2));
    }
    if (out.length > this.cfg.L0Min && rng.next() < rate * 0.2) {
      out.splice(rng.int(out.length), 1);
    }
    if (out.length > this.cfg.maxLength) out.length = this.cfg.maxLength;
    return out;
  }

  /**
   * @param {number} length
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  _randomSequence(length, rng) {
    const seq = [];
    for (let i = 0; i < length; i += 1) seq.push(rng.int(2));
    return seq;
  }

  /**
   * @param {number[]} sequence
   */
  hasFunctionalMotif(sequence) {
    return this._motifBonus(sequence) > 0;
  }

  /**
   * @param {number[]} sequence
   */
  _motifBonus(sequence) {
    let bonus = 0;
    for (const motif of this.cfg.motifs ?? []) {
      if (this._containsPattern(sequence, motif.pattern)) {
        bonus += motif.replicationBonus ?? 0;
      }
    }
    return bonus;
  }

  /** @param {number[]} haystack @param {number[]} needle */
  _containsPattern(haystack, needle) {
    if (needle.length === 0 || haystack.length < needle.length) return false;
    for (let i = 0; i <= haystack.length - needle.length; i += 1) {
      let match = true;
      for (let j = 0; j < needle.length; j += 1) {
        if (haystack[i + j] !== needle[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }

  /**
   * @param {number[]} sequence
   * @param {number} x
   * @param {number} y
   * @param {ReturnType<import('./camera.js').createRng>} rng
   * @param {number|null} lineageId
   * @param {string|null} [vesicleId]
   */
  _createStrand(sequence, x, y, rng, lineageId, vesicleId = null) {
    const angle = rng.range(0, Math.PI * 2);
    const speed = this.cfg.mobility * 0.4;
    const id = this._nextId;
    this._nextId += 1;
    const lineage = lineageId ?? this._nextLineageId++;
    return {
      id: `strand-${id}`,
      sequence,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      energy: 0.55 + rng.next() * 0.25,
      age: 0,
      lineageId: lineage,
      replicationSuccesses: 0,
      replicationAttempts: 0,
      vesicleId,
    };
  }

  /** @param {object} strand */
  _remove(strand) {
    this.list = this.list.filter((s) => s !== strand);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   */
  draw(ctx, camera) {
    const bounds = camera.getViewBounds();
    const margin = 24;
    const left = bounds.left - margin;
    const right = bounds.right + margin;
    const bottom = bounds.bottom - margin;
    const top = bounds.top + margin;

    for (const s of this.list) {
      if (s.vesicleId) continue;
      if (!this._isVisibleWrapped(s.x, s.y, left, right, bottom, top)) continue;
      const copies = this._wrapOffsets(s.x, s.y, left, right, bottom, top);
      const hue = (s.lineageId * 47) % 360;
      ctx.fillStyle = `hsla(${hue}, 70%, 62%, 0.85)`;
      ctx.strokeStyle = STRAND_COLOR;

      for (const [ox, oy] of copies) {
        const screen = camera.worldToScreen(s.x + ox, s.y + oy);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, this.cfg.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  _isVisibleWrapped(x, y, left, right, bottom, top) {
    const w = this.worldWidth;
    const h = this.worldHeight;
    for (const ox of [0, w, -w]) {
      for (const oy of [0, h, -h]) {
        const px = x + ox;
        const py = y + oy;
        if (px >= left && px <= right && py >= bottom && py <= top) return true;
      }
    }
    return false;
  }

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
}

/** @param {number[]} a @param {number[]} b */
export function sequenceSimilarity(a, b) {
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i += 1) {
    if (a[i] === b[i]) matches += 1;
  }
  const mismatches = len - matches;
  return 1 - mismatches / len;
}
