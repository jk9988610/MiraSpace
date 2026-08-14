import { wrapDelta } from "./camera.js";
import { sequenceSimilarity } from "./replicator.js";
import { ARCHETYPE_META, netOrganicCarbonGain } from "./gene-expression.js";

/**
 * S1 + optional S2 emergence metrics with sliding-window averages.
 */
export class Metrics {
  /**
   * @param {object} preset
   * @param {{ monomer: number, catalyst: number, dimer: number }} initialCounts
   * @param {import('./replicator.js').Replicator | null} [replicator]
   * @param {import('./vesicle.js').Vesicle | null} [vesicle]
   * @param {import('./chemoton.js').Chemoton | null} [chemoton]
   * @param {import('./colony.js').Colony | null} [colony]
   */
  constructor(preset, initialCounts, replicator = null, vesicle = null, chemoton = null, colony = null) {
    this.preset = preset;
    this.thresholds = preset.metricsThresholds;
    this.updateEvery = this.thresholds.updateEveryTicks ?? 10;
    this.sustainSeconds = this.thresholds.sustainSeconds ?? 60;
    this.historyMaxSamples = preset.performance?.metricsHistoryMaxSamples ?? 200;
    this.worldArea = preset.world.width * preset.world.height;

    this.initialUnevenness = this._typeUnevenness(initialCounts);
    this.baselineUnevenness = Math.max(this.initialUnevenness, 0.05);

    this.clusterIndex = 1;
    this.autocatalyticScore = 1;
    this.negentropyFlux = 1;
    this.clusterAvg = 1;
    this.autocatalyticAvg = 1;
    this.negentropyAvg = 1;
    this._history = [];

    this._intervalDimersCreated = 0;
    this._intervalDimersNearCat = 0;
    this._intervalTicks = 0;
    this._globalFormationRate = 0.001;

    this.s2Enabled = !!preset.replicator;
    this.replicator = replicator;
    this.s2Thresholds = preset.metricsThresholdsS2 ?? null;

    this.heritability = 0;
    this.selectiveSweep = 0;
    this.informationAccumulation = 1;
    this.parasiteFraction = 0;
    this.heritabilityAvg = 0;
    this.selectiveSweepAvg = 0;
    this.informationAccumulationAvg = 1;
    this._historyS2 = [];
    this._topShareStart = null;
    this._heritabilitySamples = [];

    this.s3Enabled = !!preset.vesicle;
    this.vesicle = vesicle;
    this.s3Thresholds = preset.metricsThresholdsS3 ?? null;
    this.encapsulationGain = 1;
    this.parasiteLoad = 1;
    this.fissionEvents = 0;
    this.fissionEventsRate = 0;
    this.vesicleCount = 0;
    this.encapsulationGainAvg = 1;
    this.parasiteLoadAvg = 1;
    this._historyS3 = [];
    this._fissionLog = [];
    this._pendingFissionEvents = 0;

    this.s4Enabled = !!preset.chemoton;
    this.chemoton = chemoton;
    this.s4Thresholds = preset.metricsThresholdsS4 ?? null;
    this.chemotonCoherence = 0;
    this.lineagePersistence = 0;
    this.storageFidelity = 1;
    this.chemotonCount = 0;
    this.chemotonCoherenceAvg = 0;
    this.lineagePersistenceAvg = 0;
    this._historyS4 = [];

    this.s5Enabled = !!preset.colony;
    this.colony = colony;
    this.s5Thresholds = preset.metricsThresholdsS5 ?? null;
    this.multicellularPersistence = 0;
    this.divisionOfLabor = 0;
    this.developmentalPattern = 0;
    this.colonyCount = 0;
    this.multicellularPersistenceAvg = 0;
    this.divisionOfLaborAvg = 0;
    this.developmentalPatternAvg = 0;
    this._historyS5 = [];

    this.earthEnabled = !!(preset.geneExpression && preset.atmosphere);
    this.earthThresholds = preset.metricsThresholdsEarth ?? null;
    this.trophicRichness = 0;
    this.producerBiomass = 0;
    this.netOCFlux = 0;
    this.globalO2Level = preset.atmosphere?.globalO2 ?? 0.02;
    this.globalCO2Level = preset.atmosphere?.globalCO2 ?? 0.35;
    this.globalO2Rise = 0;
    this.globalO2Avg = this.globalO2Level;
    this.cyanophytePresence = 0;
    this.heterotrophPresence = 0;
    this._initialGlobalO2 = preset.atmosphere?.globalO2 ?? 0.02;
    this._historyEarth = [];
  }

  /**
   * @param {number} tick
   * @param {number} simTime
   * @param {import('./particles.js').Particles} particles
   * @param {{ dimersCreated: number, dimersCreatedNearCatalyst: number }} particleEvents
   * @param {import('./replicator.js').Replicator | null} replicator
   * @param {object | null} replicatorEvents
   * @param {import('./vesicle.js').Vesicle | null} [vesicle]
   * @param {object | null} [vesicleEvents]
   * @param {import('./chemoton.js').Chemoton | null} [chemoton]
   * @param {import('./colony.js').Colony | null} [colony]
   * @param {import('./fields.js').Fields | null} [fields]
   */
  record(tick, simTime, particles, particleEvents, replicator, replicatorEvents, vesicle = null, vesicleEvents = null, chemoton = null, colony = null, fields = null) {
    this._intervalDimersCreated += particleEvents.dimersCreated;
    this._intervalDimersNearCat += particleEvents.dimersCreatedNearCatalyst;
    this._intervalTicks += 1;

    if (vesicleEvents?.fissionEvents) {
      this._pendingFissionEvents += vesicleEvents.fissionEvents;
    }

    if (tick % this.updateEvery !== 0) return;

    this.clusterIndex = this._computeClusterIndex(particles);
    this.autocatalyticScore = this._computeAutocatalyticScore();
    this.negentropyFlux = this._computeNegentropyFlux(particles.typeCountsSnapshot());

    this._pushHistory(simTime, {
      clusterIndex: this.clusterIndex,
      autocatalyticScore: this.autocatalyticScore,
      negentropyFlux: this.negentropyFlux,
    });

    if (this.s2Enabled && replicator && replicatorEvents) {
      this._recordS2(simTime, replicator, replicatorEvents);
    }

    if (this.s3Enabled && replicator && vesicle) {
      this._recordS3(simTime, replicator, vesicle, vesicleEvents);
    }

    if (this.s4Enabled && replicator && vesicle && chemoton) {
      this._recordS4(simTime, replicator, vesicle, chemoton);
    }

    if (this.s5Enabled && replicator && vesicle && chemoton && colony) {
      this._recordS5(simTime, vesicle, chemoton, colony);
    }

    if (this.earthEnabled && vesicle && chemoton && fields) {
      this._recordEarth(simTime, vesicle, chemoton, fields);
    }

    this._intervalDimersCreated = 0;
    this._intervalDimersNearCat = 0;
    this._intervalTicks = 0;
  }

  /**
   * @param {number} simTime
   * @param {import('./replicator.js').Replicator} replicator
   * @param {object} events
   */
  _recordS2(simTime, replicator, events) {
    for (const pair of events.replicationPairs) {
      this._heritabilitySamples.push({
        t: simTime,
        v: sequenceSimilarity(pair.parentSeq, pair.childSeq),
      });
    }
    const hWindow = this.s2Thresholds?.sustainSeconds?.heritability ?? 60;
    while (this._heritabilitySamples.length > 0 && this._heritabilitySamples[0].t < simTime - hWindow) {
      this._heritabilitySamples.shift();
    }
    if (this._heritabilitySamples.length > 0) {
      let sum = 0;
      for (const s of this._heritabilitySamples) sum += s.v;
      this.heritability = sum / this._heritabilitySamples.length;
    }

    const total = replicator.count();
    if (total > 0) {
      let top = 0;
      for (const count of events.lineageCounts.values()) {
        if (count > top) top = count;
      }
      const topShare = top / total;
      if (this._topShareStart == null) this._topShareStart = topShare;

      let mean = 0;
      let meanSq = 0;
      let n = 0;
      for (const fitnesses of events.fitnessByLineage.values()) {
        for (const f of fitnesses) {
          mean += f;
          meanSq += f * f;
          n += 1;
        }
      }
      const variance = n > 1 ? Math.max(0, meanSq / n - (mean / n) ** 2) : 0;
      this.selectiveSweep = topShare * (variance > 1e-6 ? 1 : 0.5) + Math.max(0, topShare - (this._topShareStart ?? 0));
    } else {
      this.selectiveSweep = 0;
    }

    const L0 = Math.max(1, replicator.L0Baseline());
    this.informationAccumulation = replicator.meanLength() / L0;

    const parasiteMax = replicator.cfg.parasiteMaxLen ?? 4;
    let parasites = 0;
    for (const strand of replicator.list) {
      const repRate = strand.replicationSuccesses / Math.max(1, strand.age);
      const hasMotif = replicator.hasFunctionalMotif(strand.sequence);
      if (strand.sequence.length <= parasiteMax && repRate > 0.05 && !hasMotif) {
        parasites += 1;
      }
    }
    this.parasiteFraction = total > 0 ? parasites / total : 0;

    this._pushHistoryS2(simTime, {
      heritability: this.heritability,
      selectiveSweep: this.selectiveSweep,
      informationAccumulation: this.informationAccumulation,
      parasiteFraction: this.parasiteFraction,
    });
  }

  /** @param {"clusterIndex"|"autocatalyticScore"|"negentropyFlux"} key */
  getSparklineSeries(key) {
    return this._history.map((row) => row[key]);
  }

  /** @param {"heritability"|"selectiveSweep"|"informationAccumulation"|"parasiteFraction"} key */
  getSparklineSeriesS2(key) {
    return this._historyS2.map((row) => row[key]);
  }

  /** @param {"encapsulationGain"|"parasiteLoad"|"fissionEvents"|"vesicleCount"} key */
  getSparklineSeriesS3(key) {
    return this._historyS3.map((row) => row[key]);
  }

  /** @param {"chemotonCoherence"|"lineagePersistence"|"storageFidelity"|"chemotonCount"} key */
  getSparklineSeriesS4(key) {
    return this._historyS4.map((row) => row[key]);
  }

  /** @param {"multicellularPersistence"|"divisionOfLabor"|"developmentalPattern"|"colonyCount"} key */
  getSparklineSeriesS5(key) {
    return this._historyS5.map((row) => row[key]);
  }

  /** @param {{ monomer: number, catalyst: number, dimer: number }} counts */
  _typeUnevenness(counts) {
    const total = counts.monomer + counts.catalyst + counts.dimer;
    if (total <= 0) return 0;
    const probs = [counts.monomer, counts.catalyst, counts.dimer].map((c) => c / total);
    let entropy = 0;
    for (const p of probs) {
      if (p > 1e-9) entropy -= p * Math.log(p);
    }
    const maxEntropy = Math.log(3);
    return maxEntropy > 0 ? 1 - entropy / maxEntropy : 0;
  }

  /** @param {import('./particles.js').Particles} particles */
  _computeClusterIndex(particles) {
    const dimers = particles.dimerPositions();
    if (dimers.length === 0) return 1;

    const globalDensity = dimers.length / this.worldArea;
    if (globalDensity <= 0) return 1;

    const radius = 48;
    const r2 = radius * radius;
    let sum = 0;

    for (const d of dimers) {
      let neighbors = 0;
      for (const other of dimers) {
        if (other === d) continue;
        const dx = wrapDelta(d.x, other.x, particles.worldWidth);
        const dy = wrapDelta(d.y, other.y, particles.worldHeight);
        if (dx * dx + dy * dy <= r2) neighbors += 1;
      }
      const localDensity = (neighbors + 1) / (Math.PI * r2);
      sum += localDensity / globalDensity;
    }

    return sum / dimers.length;
  }

  _computeAutocatalyticScore() {
    const ticks = Math.max(1, this._intervalTicks);
    const globalRate = this._intervalDimersCreated / ticks;
    const catRate = this._intervalDimersNearCat / ticks;

    this._globalFormationRate = this._globalFormationRate * 0.9 + globalRate * 0.1;
    const baseline = Math.max(this._globalFormationRate, 1e-6);

    if (this._intervalDimersCreated === 0) return Math.max(0.5, catRate / baseline);
    return Math.max(0, catRate / baseline);
  }

  /** @param {{ monomer: number, catalyst: number, dimer: number }} counts */
  _computeNegentropyFlux(counts) {
    const unevenness = this._typeUnevenness(counts);
    return unevenness / this.baselineUnevenness;
  }

  _pushHistory(simTime, sample) {
    this._history.push({ t: simTime, ...sample });
    const minTime = simTime - this.sustainSeconds;
    while (this._history.length > 0 && this._history[0].t < minTime) {
      this._history.shift();
    }
    while (this._history.length > this.historyMaxSamples) {
      this._history.shift();
    }

    this.clusterAvg = this._averageHistory(this._history, "clusterIndex");
    this.autocatalyticAvg = this._averageHistory(this._history, "autocatalyticScore");
    this.negentropyAvg = this._averageHistory(this._history, "negentropyFlux");
  }

  _pushHistoryS2(simTime, sample) {
    const sustain = this.s2Thresholds?.sustainSeconds?.informationAccumulation ?? 180;
    this._historyS2.push({ t: simTime, ...sample });
    const minTime = simTime - sustain;
    while (this._historyS2.length > 0 && this._historyS2[0].t < minTime) {
      this._historyS2.shift();
    }
    while (this._historyS2.length > this.historyMaxSamples) {
      this._historyS2.shift();
    }

    const hWindow = this.s2Thresholds?.sustainSeconds?.heritability ?? 60;
    this.heritabilityAvg = this._averageHistorySince(this._historyS2, "heritability", simTime - hWindow);
    const sWindow = this.s2Thresholds?.sustainSeconds?.selectiveSweep ?? 120;
    this.selectiveSweepAvg = this._averageHistorySince(this._historyS2, "selectiveSweep", simTime - sWindow);
    this.informationAccumulationAvg = this._averageHistorySince(this._historyS2, "informationAccumulation", minTime);
  }

  /**
   * @param {number} simTime
   * @param {import('./replicator.js').Replicator} replicator
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {object | null} vesicleEvents
   */
  _recordS3(simTime, replicator, vesicle, vesicleEvents) {
    if (this._pendingFissionEvents > 0) {
      this._fissionLog.push({ t: simTime, n: this._pendingFissionEvents });
      this._pendingFissionEvents = 0;
    }
    void vesicleEvents;

    const fWindow = this.s3Thresholds?.sustainSeconds?.fissionEvents ?? 300;
    while (this._fissionLog.length > 0 && this._fissionLog[0].t < simTime - fWindow) {
      this._fissionLog.shift();
    }
    let fissionSum = 0;
    for (const row of this._fissionLog) fissionSum += row.n;
    this.fissionEvents = fissionSum;
    this.fissionEventsRate = fissionSum / (fWindow / 300);

    this.vesicleCount = vesicle.count();

    let interior = 0;
    let exterior = 0;
    for (const strand of replicator.list) {
      if (strand.vesicleId) interior += 1;
      else exterior += 1;
    }

    let interiorArea = 0;
    for (const v of vesicle.list) {
      interiorArea += Math.PI * v.radius * v.radius;
    }
    const exteriorArea = Math.max(1, this.worldArea - interiorArea);
    const interiorDensity = interior / Math.max(1, interiorArea);
    const exteriorDensity = exterior / exteriorArea;

    if (interior > 0 && exterior > 0) {
      this.encapsulationGain = interiorDensity / Math.max(1e-9, exteriorDensity);
    } else if (interior > 0) {
      this.encapsulationGain = 2;
    } else {
      this.encapsulationGain = 1;
    }

    const total = replicator.count();
    this.parasiteLoad = total > 0 ? exterior / total : 1;

    this._pushHistoryS3(simTime, {
      encapsulationGain: this.encapsulationGain,
      parasiteLoad: this.parasiteLoad,
      fissionEvents: this.fissionEvents,
      vesicleCount: this.vesicleCount,
    });
  }

  _pushHistoryS3(simTime, sample) {
    const sustainGain = this.s3Thresholds?.sustainSeconds?.encapsulationGain ?? 60;
    const sustainParasite = this.s3Thresholds?.sustainSeconds?.parasiteLoad ?? 120;
    this._historyS3.push({ t: simTime, ...sample });
    const maxWindow = Math.max(sustainGain, sustainParasite, 300);
    const minTime = simTime - maxWindow;
    while (this._historyS3.length > 0 && this._historyS3[0].t < minTime) {
      this._historyS3.shift();
    }
    while (this._historyS3.length > this.historyMaxSamples) {
      this._historyS3.shift();
    }

    this.encapsulationGainAvg = this._averageHistorySince(
      this._historyS3,
      "encapsulationGain",
      simTime - sustainGain,
    );
    this.parasiteLoadAvg = this._averageHistorySince(
      this._historyS3,
      "parasiteLoad",
      simTime - sustainParasite,
    );
  }

  /**
   * @param {number} simTime
   * @param {import('./replicator.js').Replicator} replicator
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton} chemoton
   */
  _recordS4(simTime, replicator, vesicle, chemoton) {
    const total = vesicle.count();
    let coherent = 0;
    for (const v of vesicle.list) {
      if (chemoton.isCoherent(v)) coherent += 1;
    }
    this.chemotonCoherence = total > 0 ? coherent / total : 0;
    this.chemotonCount = coherent;
    this.lineagePersistence = chemoton.lineagePersistenceGenerations(vesicle);
    this.storageFidelity = chemoton.storageFidelity(vesicle, replicator);

    this._pushHistoryS4(simTime, {
      chemotonCoherence: this.chemotonCoherence,
      lineagePersistence: this.lineagePersistence,
      storageFidelity: this.storageFidelity,
      chemotonCount: this.chemotonCount,
    });
  }

  _pushHistoryS4(simTime, sample) {
    const sustainC = this.s4Thresholds?.sustainSeconds?.chemotonCoherence ?? 120;
    const sustainL = this.s4Thresholds?.sustainSeconds?.lineagePersistence ?? 300;
    this._historyS4.push({ t: simTime, ...sample });
    const minTime = simTime - Math.max(sustainC, sustainL);
    while (this._historyS4.length > 0 && this._historyS4[0].t < minTime) {
      this._historyS4.shift();
    }
    while (this._historyS4.length > this.historyMaxSamples) {
      this._historyS4.shift();
    }

    this.chemotonCoherenceAvg = this._averageHistorySince(
      this._historyS4,
      "chemotonCoherence",
      simTime - sustainC,
    );
    this.lineagePersistenceAvg = this._averageHistorySince(
      this._historyS4,
      "lineagePersistence",
      simTime - sustainL,
    );
  }

  /**
   * @param {number} simTime
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton} chemoton
   * @param {import('./colony.js').Colony} colony
   */
  _recordS5(simTime, vesicle, chemoton, colony) {
    this.multicellularPersistence = colony.multicellularPersistenceRatio(vesicle);
    this.divisionOfLabor = colony.divisionOfLaborShare(vesicle);
    this.developmentalPattern = colony.developmentalPatternScore(vesicle);
    this.colonyCount = colony.count();

    this._pushHistoryS5(simTime, {
      multicellularPersistence: this.multicellularPersistence,
      divisionOfLabor: this.divisionOfLabor,
      developmentalPattern: this.developmentalPattern,
      colonyCount: this.colonyCount,
    });
    void chemoton;
  }

  _pushHistoryS5(simTime, sample) {
    const sustainP = this.s5Thresholds?.sustainSeconds?.persistence ?? 120;
    const sustainL = this.s5Thresholds?.sustainSeconds?.labor ?? 180;
    const sustainD = this.s5Thresholds?.sustainSeconds?.pattern ?? 180;
    this._historyS5.push({ t: simTime, ...sample });
    const minTime = simTime - Math.max(sustainP, sustainL, sustainD);
    while (this._historyS5.length > 0 && this._historyS5[0].t < minTime) {
      this._historyS5.shift();
    }
    while (this._historyS5.length > this.historyMaxSamples) {
      this._historyS5.shift();
    }

    this.multicellularPersistenceAvg = this._averageHistorySince(
      this._historyS5,
      "multicellularPersistence",
      simTime - sustainP,
    );
    this.divisionOfLaborAvg = this._averageHistorySince(
      this._historyS5,
      "divisionOfLabor",
      simTime - sustainL,
    );
    this.developmentalPatternAvg = this._averageHistorySince(
      this._historyS5,
      "developmentalPattern",
      simTime - sustainD,
    );
  }

  /**
   * @param {number} simTime
   * @param {import('./vesicle.js').Vesicle} vesicle
   * @param {import('./chemoton.js').Chemoton} chemoton
   * @param {import('./fields.js').Fields} fields
   */
  _recordEarth(simTime, vesicle, chemoton, fields) {
    const archetypes = new Set();
    let producerBiomass = 0;
    let totalBiomass = 0;
    let netOC = 0;
    let heterotrophCount = 0;

    for (const v of vesicle.list) {
      if (!v.chemoton) continue;
      const arch = v.chemoton.archetype ?? v.chemoton.effectiveArchetype ?? "leaky_heterotroph";
      archetypes.add(arch);
      const bm = v.biomass ?? 0;
      totalBiomass += bm;

      const meta = ARCHETYPE_META[arch];
      if (meta?.trophicRole === "producer") producerBiomass += bm;
      if (meta?.trophicRole === "consumer" || meta?.trophicRole === "decomposer") {
        heterotrophCount += 1;
      }

      if (arch === "cyanophyte") {
        this.cyanophytePresence = 1;
      }

      const flux = v.chemoton._lastGeneFlux;
      if (flux) netOC += netOrganicCarbonGain(flux);
    }

    this.trophicRichness = archetypes.size;
    this.producerBiomass = totalBiomass > 0 ? producerBiomass / totalBiomass : 0;
    this.netOCFlux = netOC / Math.max(1, vesicle.count());
    this.globalO2Level = fields.globalO2;
    this.globalCO2Level = fields.globalCO2;
    this.globalO2Rise = fields.globalO2 - this._initialGlobalO2;
    this.heterotrophPresence = heterotrophCount > 0 ? 1 : 0;

    this._pushHistoryEarth(simTime, {
      trophicRichness: this.trophicRichness,
      producerBiomass: this.producerBiomass,
      netOCFlux: this.netOCFlux,
      globalO2: this.globalO2Level,
      globalO2Rise: this.globalO2Rise,
      cyanophytePresence: this.cyanophytePresence,
      heterotrophPresence: this.heterotrophPresence,
    });

    const sustain = this.earthThresholds?.sustainSeconds?.globalO2 ?? 90;
    this.globalO2Avg = this._averageHistorySince(this._historyEarth, "globalO2", simTime - sustain);
    void chemoton;
  }

  /** @param {number} simTime @param {object} row */
  _pushHistoryEarth(simTime, row) {
    this._historyEarth.push({ t: simTime, ...row });
    while (this._historyEarth.length > this.historyMaxSamples) {
      this._historyEarth.shift();
    }
  }

  /** @param {object[]} history @param {string} key */
  _averageHistory(history, key) {
    if (history.length === 0) return this[key] ?? 0;
    let sum = 0;
    for (const row of history) sum += row[key];
    return sum / history.length;
  }

  /** @param {object[]} history @param {string} key @param {number} minTime */
  _averageHistorySince(history, key, minTime) {
    const rows = history.filter((row) => row.t >= minTime);
    if (rows.length === 0) return this[key] ?? 0;
    let sum = 0;
    for (const row of rows) sum += row[key];
    return sum / rows.length;
  }

  formatHud() {
    const base = {
      clusterIndex: this.clusterIndex,
      clusterAvg: this.clusterAvg,
      autocatalyticScore: this.autocatalyticScore,
      autocatalyticAvg: this.autocatalyticAvg,
      negentropyFlux: this.negentropyFlux,
      negentropyAvg: this.negentropyAvg,
    };
    if (!this.s2Enabled) return base;
    const out = {
      ...base,
      heritability: this.heritability,
      heritabilityAvg: this.heritabilityAvg,
      selectiveSweep: this.selectiveSweep,
      selectiveSweepAvg: this.selectiveSweepAvg,
      informationAccumulation: this.informationAccumulation,
      informationAccumulationAvg: this.informationAccumulationAvg,
      parasiteFraction: this.parasiteFraction,
      strandCount: this.replicator?.count() ?? 0,
    };
    if (!this.s3Enabled) return out;
    const s3out = {
      ...out,
      encapsulationGain: this.encapsulationGain,
      encapsulationGainAvg: this.encapsulationGainAvg,
      parasiteLoad: this.parasiteLoad,
      parasiteLoadAvg: this.parasiteLoadAvg,
      fissionEvents: this.fissionEvents,
      fissionEventsRate: this.fissionEventsRate,
      vesicleCount: this.vesicleCount,
    };
    if (!this.s4Enabled) return s3out;
    const s4out = {
      ...s3out,
      chemotonCoherence: this.chemotonCoherence,
      chemotonCoherenceAvg: this.chemotonCoherenceAvg,
      lineagePersistence: this.lineagePersistence,
      lineagePersistenceAvg: this.lineagePersistenceAvg,
      storageFidelity: this.storageFidelity,
      chemotonCount: this.chemotonCount,
    };
    if (!this.s5Enabled) return s4out;
    const s5out = {
      ...s4out,
      multicellularPersistence: this.multicellularPersistence,
      multicellularPersistenceAvg: this.multicellularPersistenceAvg,
      divisionOfLabor: this.divisionOfLabor,
      divisionOfLaborAvg: this.divisionOfLaborAvg,
      developmentalPattern: this.developmentalPattern,
      developmentalPatternAvg: this.developmentalPatternAvg,
      colonyCount: this.colonyCount,
    };
    if (!this.earthEnabled) return s5out;
    return {
      ...s5out,
      trophicRichness: this.trophicRichness,
      producerBiomass: this.producerBiomass,
      netOCFlux: this.netOCFlux,
      globalO2Level: this.globalO2Level,
      globalCO2Level: this.globalCO2Level,
      globalO2Rise: this.globalO2Rise,
      globalO2Avg: this.globalO2Avg,
      cyanophytePresence: this.cyanophytePresence,
      heterotrophPresence: this.heterotrophPresence,
    };
  }
}
