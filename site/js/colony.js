import { wrapCoord, wrapDelta } from "./camera.js";
import { decodeSequence, computeEffectivePhenotype } from "./gene-expression.js";
import { dominantInteriorSequence } from "./gene-flux.js";

/**
 * Colony: persistent adhesion between chemoton vesicles after fission.
 * No script spawn — links emerge only from fission events.
 */
export class Colony {
  /**
   * @param {object} preset
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(preset, worldWidth, worldHeight) {
    this.cfg = preset.colony;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.list = [];
    this._nextId = 1;
    this._singletonLifespanSum = 0;
    this._singletonLifespanN = 0;
    this._colonyLifespanSum = 0;
    this._colonyLifespanN = 0;
  }

  count() {
    return this.list.length;
  }

  /** @param {string} id */
  byId(id) {
    return this.list.find((c) => c.id === id) ?? null;
  }

  /**
   * @param {number} lineageId
   */
  _createColony(lineageId) {
    const id = this._nextId;
    this._nextId += 1;
    return {
      id: `colony-${id}`,
      memberVesicleIds: [],
      age: 0,
      lineageId,
      birthTick: 0,
    };
  }

  /**
   * @param {object} parent
   * @param {object} childA
   * @param {object} childB
   * @param {import('./vesicle.js').Vesicle} vesicle
   */
  onFission(parent, childA, childB, vesicle) {
    let colony = parent.colonyId ? this.byId(parent.colonyId) : null;

    if (!colony) {
      colony = this._createColony(parent.lineageId);
      this.list.push(colony);
    }

    if (parent.colonyId) {
      colony.memberVesicleIds = colony.memberVesicleIds.filter((id) => id !== parent.id);
    } else if (parent.age > 0) {
      this._singletonLifespanSum += parent.age;
      this._singletonLifespanN += 1;
    }

    childA.colonyId = colony.id;
    childB.colonyId = colony.id;
    childA.links = childA.links ?? [];
    childB.links = childB.links ?? [];

    this._addLink(childA, childB.id, this.cfg.linkStrength0 ?? 0.8);
    this._addLink(childB, childA.id, this.cfg.linkStrength0 ?? 0.8);

    if (!colony.memberVesicleIds.includes(childA.id)) colony.memberVesicleIds.push(childA.id);
    if (!colony.memberVesicleIds.includes(childB.id)) colony.memberVesicleIds.push(childB.id);

    if (colony.memberVesicleIds.length > (this.cfg.maxMembers ?? 24)) {
      this._trimColony(colony, vesicle);
    }
  }

  /**
   * @param {object} v
   * @param {string} targetId
   * @param {number} strength
   */
  _addLink(v, targetId, strength) {
    if (!v.links) v.links = [];
    const existing = v.links.find((l) => l.targetId === targetId);
    if (existing) {
      existing.strength = Math.max(existing.strength, strength);
    } else {
      v.links.push({ targetId, strength });
    }
  }

  /**
   * @param {object} colony
   * @param {import('./vesicle.js').Vesicle} vesicle
   */
  _trimColony(colony, vesicle) {
    while (colony.memberVesicleIds.length > (this.cfg.maxMembers ?? 24)) {
      const dropId = colony.memberVesicleIds.pop();
      const v = vesicle.byId(dropId);
      if (v) {
        v.colonyId = null;
        v.links = [];
      }
    }
  }

  /**
   * E5: set effectiveM/T from local fields (does not mutate sequence).
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./fields.js').Fields | null} fields
   * @param {import('./replicator.js').Replicator | null} replicator
   */
  updatePhenotypes(vesicle, fields, replicator) {
    if (!fields?.ecologyEnabled || !replicator) return;

    const multiMemberIds = new Set();
    for (const colony of this.list) {
      if (colony.memberVesicleIds.length >= 2) {
        for (const id of colony.memberVesicleIds) multiMemberIds.add(id);
      }
    }

    for (const v of vesicle.list) {
      if (!v.chemoton) continue;
      if (!multiMemberIds.has(v.id)) {
        delete v.chemoton.effectiveM;
        delete v.chemoton.effectiveT;
        delete v.chemoton.effectiveArchetype;
        delete v.chemoton.genotypeArchetype;
      }
    }

    for (const colony of this.list) {
      const members = colony.memberVesicleIds
        .map((id) => vesicle.byId(id))
        .filter((v) => v?.chemoton);

      if (members.length < 2) continue;

      let sumDOC = 0;
      let sumLight = 0;
      const samples = [];

      for (const m of members) {
        const localDOC = fields.sampleDOC(m.x, m.y);
        const exprEnv = fields.sampleExpressionEnv(m.x, m.y);
        const localLight = exprEnv.light ?? 1;
        sumDOC += localDOC;
        sumLight += localLight;
        samples.push({ m, localDOC, localLight });
      }

      const meanDOC = sumDOC / members.length;
      const meanLight = sumLight / members.length;

      for (const { m, localDOC, localLight } of samples) {
        const sequence = dominantInteriorSequence(m, replicator);
        if (!sequence) continue;

        const decoded = decodeSequence(sequence);
        const pheno = computeEffectivePhenotype(decoded, {
          localDOC,
          localLight,
          meanDOC,
          meanLight,
        });
        const c = m.chemoton;
        c.genotypeArchetype = decoded.archetype;
        c.effectiveM = pheno.effectiveM;
        c.effectiveT = pheno.effectiveT;
        c.effectiveArchetype = pheno.effectiveArchetype;
      }
    }
  }

  /**
   * @param {number} dt
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton | null} chemoton
   */
  step(dt, vesicle, chemoton) {
    for (const colony of this.list) {
      colony.age += 1;
    }

    this._updateLinks(dt, vesicle);
    this._applyLinkSprings(dt, vesicle);
    if (chemoton) {
      this._transferFlux(vesicle, chemoton);
      this._updateRoles(vesicle, chemoton);
    }
    this._cleanupColonies(vesicle);
  }

  /**
   * @param {number} dt
   * @param {import('./vesicle.js').Vesicle} vesicle
   */
  _updateLinks(dt, vesicle) {
    const decay = this.cfg.linkDecay ?? 0.0001;
    const breakT = this.cfg.linkBreakThreshold ?? 0.2;

    for (const v of vesicle.list) {
      if (!v.links?.length) continue;
      v.links = v.links.filter((link) => {
        link.strength -= decay * dt;
        return link.strength >= breakT && vesicle.byId(link.targetId);
      });
    }
  }

  /**
   * @param {number} dt
   * @param {import('./vesicle.js').Vesicle} vesicle
   */
  _applyLinkSprings(dt, vesicle) {
    for (const v of vesicle.list) {
      if (!v.links?.length) continue;
      for (const link of v.links) {
        const other = vesicle.byId(link.targetId);
        if (!other) continue;

        const dx = wrapDelta(v.x, other.x, this.worldWidth);
        const dy = wrapDelta(v.y, other.y, this.worldHeight);
        const dist = Math.hypot(dx, dy);
        const rest = (v.radius + other.radius) * 0.85;
        if (dist < 1e-6) continue;

        const pull = link.strength * (dist - rest) * 0.035 * dt;
        const nx = dx / dist;
        const ny = dy / dist;

        v.x = wrapCoord(v.x + nx * pull, this.worldWidth);
        v.y = wrapCoord(v.y + ny * pull, this.worldHeight);
        other.x = wrapCoord(other.x - nx * pull, this.worldWidth);
        other.y = wrapCoord(other.y - ny * pull, this.worldHeight);
      }
    }
  }

  /**
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton} chemoton
   */
  _transferFlux(vesicle, chemoton) {
    const rate = this.cfg.fluxTransferRate ?? 0.05;

    for (const colony of this.list) {
      const members = colony.memberVesicleIds
        .map((id) => vesicle.byId(id))
        .filter((v) => v?.chemoton);

      if (members.length < 2) continue;

      members.sort((a, b) => b.chemoton.metabolicFlux - a.chemoton.metabolicFlux);
      const donor = members[0];
      const recipient = members[members.length - 1];
      if (donor.chemoton.metabolicFlux <= recipient.chemoton.metabolicFlux + 0.05) continue;

      const delta = (donor.chemoton.metabolicFlux - recipient.chemoton.metabolicFlux) * rate;
      donor.chemoton.metabolicFlux = Math.max(0, donor.chemoton.metabolicFlux - delta * 0.5);
      recipient.chemoton.metabolicFlux = Math.min(1, recipient.chemoton.metabolicFlux + delta);
      void chemoton;
    }
  }

  /**
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton} chemoton
   */
  _updateRoles(vesicle, chemoton) {
    for (const colony of this.list) {
      const members = colony.memberVesicleIds
        .map((id) => vesicle.byId(id))
        .filter((v) => v?.chemoton);

      if (members.length === 0) continue;

      const fluxes = members.map((m) => m.chemoton.metabolicFlux);
      const genetics = members.map((m) => m.chemoton.geneticActivity);
      const fluxQ3 = quartile(fluxes, 0.75);
      const genQ3 = quartile(genetics, 0.75);

      for (const m of members) {
        const c = m.chemoton;
        if (c.metabolicFlux >= fluxQ3 && members.length > 1) {
          c.role = "feeder";
        } else if (c.geneticActivity >= genQ3 && members.length > 1) {
          c.role = "replicator";
        } else {
          c.role = "default";
        }
      }
    }
    void chemoton;
  }

  /**
   * @param {import('./vesicle.js').Vesicle} vesicle
   */
  _cleanupColonies(vesicle) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const colony = this.list[i];
      colony.memberVesicleIds = colony.memberVesicleIds.filter((id) => {
        const v = vesicle.byId(id);
        return v && v.colonyId === colony.id;
      });

      if (colony.memberVesicleIds.length >= 2) continue;

      if (colony.memberVesicleIds.length === 1) {
        const v = vesicle.byId(colony.memberVesicleIds[0]);
        if (v) {
          v.colonyId = null;
          v.links = [];
        }
      }

      if (colony.age > 0) {
        this._colonyLifespanSum += colony.age;
        this._colonyLifespanN += 1;
      }
      this.list.splice(i, 1);
    }
  }

  /** @param {object} v @param {import('./vesicle.js').Vesicle} vesicle */
  onMemberLysis(v, vesicle) {
    if (!v.colonyId) return;
    const colony = this.byId(v.colonyId);
    if (!colony) return;

    colony.memberVesicleIds = colony.memberVesicleIds.filter((id) => id !== v.id);
    for (const memberId of colony.memberVesicleIds) {
      const member = vesicle.byId(memberId);
      if (!member?.links) continue;
      member.links = member.links.filter((l) => l.targetId !== v.id);
    }
  }

  /**
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton | null} chemoton
   */
  colonyFitness(vesicle, chemoton) {
    let sum = 0;
    let n = 0;
    for (const colony of this.list) {
      let memberFitness = 0;
      let mN = 0;
      let activeLinks = 0;
      let possibleLinks = 0;

      for (const id of colony.memberVesicleIds) {
        const v = vesicle.byId(id);
        if (!v) continue;
        if (chemoton) memberFitness += chemoton.fitness(v);
        mN += 1;
        possibleLinks += Math.max(1, v.links?.length ?? 0);
        for (const link of v.links ?? []) {
          if (link.strength >= (this.cfg.linkBreakThreshold ?? 0.2)) activeLinks += 1;
        }
      }

      if (mN === 0) continue;
      const linkBonus = possibleLinks > 0 ? activeLinks / possibleLinks : 0;
      sum += (memberFitness / mN) * (0.5 + 0.5 * linkBonus);
      n += 1;
    }
    return n > 0 ? sum / n : 0;
  }

  /** @param {import('./vesicle.js').Vesicle} vesicle */
  divisionOfLaborShare(vesicle) {
    if (this.list.length === 0) return 0;
    let withLabor = 0;
    for (const colony of this.list) {
      const roles = new Set();
      const effectiveArchetypes = new Set();
      for (const id of colony.memberVesicleIds) {
        const v = vesicle.byId(id);
        if (v?.chemoton?.role) roles.add(v.chemoton.role);
        const eff = v?.chemoton?.effectiveArchetype ?? v?.chemoton?.archetype;
        if (eff) effectiveArchetypes.add(eff);
      }
      if (roles.size >= 2 || effectiveArchetypes.size >= 2) withLabor += 1;
    }
    return withLabor / this.list.length;
  }

  /** @param {import('./vesicle.js').Vesicle} vesicle */
  phenotypicArchetypeRichness(vesicle) {
    let best = 0;
    for (const colony of this.list) {
      if (colony.memberVesicleIds.length < 2) continue;
      const archs = new Set();
      for (const id of colony.memberVesicleIds) {
        const v = vesicle.byId(id);
        const eff = v?.chemoton?.effectiveArchetype ?? v?.chemoton?.archetype;
        if (eff) archs.add(eff);
      }
      best = Math.max(best, archs.size);
    }
    return best;
  }

  /** @param {import('./vesicle.js').Vesicle} vesicle */
  developmentalPatternScore(vesicle) {
    if (this.list.length === 0) return 0;
    let sum = 0;
    let n = 0;

    for (const colony of this.list) {
      const members = colony.memberVesicleIds
        .map((id) => vesicle.byId(id))
        .filter(Boolean);
      if (members.length < 2) continue;

      let linkDist = 0;
      let linkN = 0;
      for (const v of members) {
        for (const link of v.links ?? []) {
          const other = vesicle.byId(link.targetId);
          if (!other) continue;
          const dx = wrapDelta(v.x, other.x, this.worldWidth);
          const dy = wrapDelta(v.y, other.y, this.worldHeight);
          linkDist += Math.hypot(dx, dy);
          linkN += 1;
        }
      }
      if (linkN === 0) continue;

      const meanLink = linkDist / linkN;
      let meanRandom = 0;
      let rN = 0;
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          const dx = wrapDelta(members[i].x, members[j].x, this.worldWidth);
          const dy = wrapDelta(members[i].y, members[j].y, this.worldHeight);
          meanRandom += Math.hypot(dx, dy);
          rN += 1;
        }
      }
      if (rN === 0) continue;
      meanRandom /= rN;
      sum += Math.max(0, 1 - meanLink / Math.max(meanRandom, 1));
      n += 1;
    }
    return n > 0 ? sum / n : 0;
  }

  /**
   * @param {import('./vesicle.js').Vesicle | null} [vesicle]
   */
  multicellularPersistenceRatio(vesicle = null) {
    let singletonAvg = this._singletonLifespanN > 0
      ? this._singletonLifespanSum / this._singletonLifespanN
      : 0;
    if (singletonAvg <= 0 && vesicle) {
      let ageSum = 0;
      let n = 0;
      for (const v of vesicle.list) {
        if (!v.colonyId) {
          ageSum += v.age;
          n += 1;
        }
      }
      singletonAvg = n > 0 ? ageSum / n : 1;
    }
    if (singletonAvg <= 0) singletonAvg = 1;

    let colonyAvg = this._colonyLifespanN > 0
      ? this._colonyLifespanSum / this._colonyLifespanN
      : 0;
    let liveAgeSum = 0;
    let liveN = 0;
    for (const colony of this.list) {
      if (colony.memberVesicleIds.length >= 2) {
        liveAgeSum += colony.age;
        liveN += 1;
      }
    }
    if (liveN > 0) {
      colonyAvg = Math.max(colonyAvg, liveAgeSum / liveN);
    }
    if (colonyAvg <= 0) return 0;
    return colonyAvg / Math.max(1, singletonAvg);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   * @param {import('./vesicle.js').Vesicle} vesicle
   */
  drawLinks(ctx, camera, vesicle) {
    const drawn = new Set();
    for (const v of vesicle.list) {
      if (!v.links?.length) continue;
      for (const link of v.links) {
        const key = [v.id, link.targetId].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);

        const other = vesicle.byId(link.targetId);
        if (!other) continue;

        const a = camera.worldToScreen(v.x, v.y);
        const b = camera.worldToScreen(other.x, other.y);
        ctx.strokeStyle = `rgba(180, 240, 200, ${0.25 + link.strength * 0.55})`;
        ctx.lineWidth = 1 + link.strength;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}

/** @param {number[]} values @param {number} q */
function quartile(values, q) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}
