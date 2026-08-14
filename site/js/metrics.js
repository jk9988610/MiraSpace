import { wrapDelta } from "./camera.js";

/**
 * S1 emergence metrics with sliding-window averages.
 */
export class Metrics {
  /**
   * @param {object} preset
   * @param {{ monomer: number, catalyst: number, dimer: number }} initialCounts
   */
  constructor(preset, initialCounts) {
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
  }

  /**
   * @param {number} tick
   * @param {number} simTime
   * @param {import('./particles.js').Particles} particles
   * @param {{ dimersCreated: number, dimersCreatedNearCatalyst: number }} events
   */
  record(tick, simTime, particles, events) {
    this._intervalDimersCreated += events.dimersCreated;
    this._intervalDimersNearCat += events.dimersCreatedNearCatalyst;
    this._intervalTicks += 1;

    if (tick % this.updateEvery !== 0) return;

    this.clusterIndex = this._computeClusterIndex(particles);
    this.autocatalyticScore = this._computeAutocatalyticScore();
    this.negentropyFlux = this._computeNegentropyFlux(particles.typeCountsSnapshot());

    this._pushHistory(simTime, {
      clusterIndex: this.clusterIndex,
      autocatalyticScore: this.autocatalyticScore,
      negentropyFlux: this.negentropyFlux,
    });

    this._intervalDimersCreated = 0;
    this._intervalDimersNearCat = 0;
    this._intervalTicks = 0;
  }

  /** @param {"clusterIndex"|"autocatalyticScore"|"negentropyFlux"} key */
  getSparklineSeries(key) {
    return this._history.map((row) => row[key]);
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

  /**
   * @param {number} simTime
   * @param {{ clusterIndex: number, autocatalyticScore: number, negentropyFlux: number }} sample
   */
  _pushHistory(simTime, sample) {
    this._history.push({ t: simTime, ...sample });
    const minTime = simTime - this.sustainSeconds;
    while (this._history.length > 0 && this._history[0].t < minTime) {
      this._history.shift();
    }
    while (this._history.length > this.historyMaxSamples) {
      this._history.shift();
    }

    this.clusterAvg = this._averageHistory("clusterIndex");
    this.autocatalyticAvg = this._averageHistory("autocatalyticScore");
    this.negentropyAvg = this._averageHistory("negentropyFlux");
  }

  /** @param {"clusterIndex"|"autocatalyticScore"|"negentropyFlux"} key */
  _averageHistory(key) {
    if (this._history.length === 0) return this[key];
    let sum = 0;
    for (const row of this._history) sum += row[key];
    return sum / this._history.length;
  }

  formatHud() {
    return {
      clusterIndex: this.clusterIndex,
      clusterAvg: this.clusterAvg,
      autocatalyticScore: this.autocatalyticScore,
      autocatalyticAvg: this.autocatalyticAvg,
      negentropyFlux: this.negentropyFlux,
      negentropyAvg: this.negentropyAvg,
    };
  }
}
