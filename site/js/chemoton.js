import { wrapDelta } from "./camera.js";

/**
 * Chemoton coupling layer: metabolic + membrane + genetic subsystems on vesicle.
 */
export class Chemoton {
  /**
   * @param {object} preset
   */
  constructor(preset) {
    this.cfg = preset.chemoton;
    this._lineageBirth = new Map();
    this._lineageDeath = new Map();
  }

  /**
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  createState(rng) {
    return {
      metabolicFlux: 0.25 + rng.next() * 0.2,
      membraneHealth: 0.55 + rng.next() * 0.25,
      geneticActivity: 0.15,
      coherenceTicks: 0,
      storageMode: "linear",
      _geneticLog: [],
      _baseMutationRate: null,
    };
  }

  /**
   * @param {object} v vesicle
   * @param {import('./particles.js').Particles} particles
   * @param {import('./fields.js').Fields} fields
   * @param {number} dt
   * @param {number} worldWidth
   * @param {number} worldHeight
   * @param {import('./replicator.js').Replicator} replicator
   */
  updateMetabolism(v, particles, fields, dt, worldWidth, worldHeight, replicator) {
    if (!v.chemoton) return;

    const c = v.chemoton;
    let monomers = 0;
    let catalysts = 0;
    const r = v.radius * 0.92;
    const r2 = r * r;

    for (const p of particles.list) {
      const dx = wrapDelta(v.x, p.x, worldWidth);
      const dy = wrapDelta(v.y, p.y, worldHeight);
      if (dx * dx + dy * dy > r2) continue;
      if (p.type === "monomer") monomers += 1;
      if (p.type === "catalyst") catalysts += 1;
    }

    let interiorStrands = 0;
    for (const sid of v.interior) {
      if (replicator.list.some((s) => s.id === sid)) interiorStrands += 1;
    }

    const fieldEnergy = fields.sampleEnergy(v.x, v.y);
    const permeability = 0.3;
    const reactionRate = Math.min(monomers, 10) * Math.min(catalysts + 1, 5) * 0.015
      + interiorStrands * 0.04
      + v.localPool * 0.35
      + fieldEnergy * permeability * 0.12;
    const norm = this.cfg.metabolicNormalize ?? 0.45;
    c.metabolicFlux = clamp01(reactionRate / norm);

    const maintenance = this.cfg.membraneMaintenance ?? 0.012;
    c.membraneHealth -= maintenance * dt;
    c.membraneHealth += c.metabolicFlux * (this.cfg.repairBonus ?? 0.05) * dt;
    c.membraneHealth = clamp01(c.membraneHealth);

    if (c.membraneHealth <= 0) {
      v._pendingLysis = true;
    }
  }

  /**
   * @param {object} v
   * @param {import('./replicator.js').Replicator} replicator
   * @param {number} simTime
   * @param {number} dt
   */
  updateGeneticAndCoherence(v, replicator, simTime, dt) {
    if (!v.chemoton) return;

    const c = v.chemoton;
    const window = this.cfg.geneticWindowSeconds ?? 30;
    while (c._geneticLog.length > 0 && c._geneticLog[0].t < simTime - window) {
      c._geneticLog.shift();
    }

    let attempts = 0;
    let successes = 0;
    for (const row of c._geneticLog) {
      attempts += 1;
      if (row.success) successes += 1;
    }
    c.geneticActivity = attempts > 0 ? successes / attempts : c.geneticActivity * 0.98;

    const min = this.cfg.subsystemMin ?? 0.35;
    if (c.metabolicFlux > min && c.membraneHealth > min && c.geneticActivity > min) {
      c.coherenceTicks += 1;
    } else {
      c.coherenceTicks = Math.max(0, c.coherenceTicks - 1);
    }

    this._tryStorageEmergence(v, replicator);
    void dt;
  }

  /**
   * @param {object} v
   * @param {import('./replicator.js').Replicator} replicator
   */
  _tryStorageEmergence(v, replicator) {
    const c = v.chemoton;
    if (c.storageMode === "redundant") return;

    const emerg = this.cfg.storageEmergence ?? {};
    let lenSum = 0;
    let lenN = 0;
    for (const sid of v.interior) {
      const strand = replicator.list.find((s) => s.id === sid);
      if (!strand) continue;
      lenSum += strand.sequence.length;
      lenN += 1;
    }
    const meanLen = lenN > 0 ? lenSum / lenN : 0;

    if (
      c.metabolicFlux > (emerg.fluxMin ?? 0.5)
      && c.membraneHealth > (emerg.healthMin ?? 0.6)
      && meanLen > (emerg.lengthMin ?? 12)
    ) {
      c.storageMode = "redundant";
    }
  }

  /** @param {object} v */
  fitness(v) {
    const c = v.chemoton;
    if (!c) return 0;
    return c.metabolicFlux * c.membraneHealth * (0.5 + 0.5 * c.geneticActivity);
  }

  /**
   * @param {object} v
   * @param {number} radiusThreshold
   */
  canFission(v, radiusThreshold) {
    if (!v.chemoton) return v.radius >= radiusThreshold;
    const c = v.chemoton;
    return v.radius >= radiusThreshold
      && this.fitness(v) >= (this.cfg.fissionFitnessMin ?? 0.4)
      && c.coherenceTicks >= (this.cfg.coherenceMinTicks ?? 90);
  }

  /** @param {object} v */
  replicationMultiplier(v) {
    if (!v.chemoton) return 1;
    const c = v.chemoton;
    return Math.max(0.05, c.metabolicFlux * c.membraneHealth);
  }

  /**
   * @param {object} v
   * @param {number} simTime
   * @param {boolean} success
   */
  logReplication(v, simTime, success) {
    if (!v?.chemoton) return;
    v.chemoton._geneticLog.push({ t: simTime, success });
  }

  /**
   * @param {object} parent
   * @param {ReturnType<import('./camera.js').createRng>} rng
   */
  inheritState(parent, rng) {
    const p = parent.chemoton;
    const noise = this.cfg.inheritanceNoise ?? 0.12;
    const jitter = () => 1 + (rng.next() - 0.5) * noise * 2;
    return {
      metabolicFlux: clamp01(p.metabolicFlux * jitter()),
      membraneHealth: clamp01(p.membraneHealth * jitter()),
      geneticActivity: clamp01(p.geneticActivity * jitter()),
      coherenceTicks: Math.max(0, Math.floor(p.coherenceTicks * (0.4 + rng.next() * 0.25))),
      storageMode: p.storageMode,
      _geneticLog: [],
      _baseMutationRate: null,
    };
  }

  /** @param {object} v */
  isCoherent(v) {
    if (!v.chemoton) return false;
    const min = this.cfg.subsystemMin ?? 0.35;
    const c = v.chemoton;
    return c.metabolicFlux > min && c.membraneHealth > min && c.geneticActivity > min;
  }

  /** @param {object} v @param {number} simTime */
  registerBirth(v, simTime) {
    this._lineageBirth.set(v.lineageId, simTime);
  }

  /** @param {object} v @param {number} simTime */
  registerDeath(v, simTime) {
    this._lineageDeath.set(v.lineageId, simTime);
  }

  /** @param {import('./vesicle.js').Vesicle} vesicle */
  lineagePersistenceGenerations(vesicle) {
    let sum = 0;
    let n = 0;
    for (const v of vesicle.list) {
      const birth = this._lineageBirth.get(v.lineageId) ?? 0;
      const gen = Math.max(1, v.age / (30 / 0.033333));
      void birth;
      sum += gen;
      n += 1;
    }
    if (n === 0) {
      for (const [id, birth] of this._lineageBirth) {
        const death = this._lineageDeath.get(id) ?? birth;
        sum += Math.max(1, (death - birth) / 10);
        n += 1;
      }
    }
    return n > 0 ? sum / n : 0;
  }

  /** @param {import('./vesicle.js').Vesicle} vesicle @param {import('./replicator.js').Replicator} replicator */
  storageFidelity(vesicle, replicator) {
    let redundant = 0;
    let total = 0;
    for (const v of vesicle.list) {
      if (v.chemoton?.storageMode !== "redundant") continue;
      redundant += 1;
      for (const sid of v.interior) {
        const strand = replicator.list.find((s) => s.id === sid);
        if (strand) total += 1;
      }
    }
    if (redundant === 0) return 1;
    return total > 0 ? 0.5 : 1;
  }
}

/** @param {number} x */
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
