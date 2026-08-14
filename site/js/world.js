import { Fields } from "./fields.js";
import { Particles } from "./particles.js";
import { Metrics } from "./metrics.js";
import { Replicator } from "./replicator.js";
import { createRng } from "./camera.js";

/**
 * Simulation world: fixed-tick loop, fields, particles, metrics, optional replicators.
 */
export class World {
  /**
   * @param {object} preset
   * @param {number} [seedOverride]
   */
  constructor(preset, seedOverride) {
    this.preset = preset;
    this.presetName = preset._name ?? "stage0-default";
    this.width = preset.world.width;
    this.height = preset.world.height;
    this.boundary = preset.world.boundary;
    this.dt = preset.sim.dt;
    this.maxSubsteps = preset.sim.maxSubsteps;

    const seed = seedOverride ?? preset.sim.seed;
    this.rng = createRng(seed);
    this.seed = seed;

    this.tickCount = 0;
    this.simTime = 0;
    this.paused = false;
    this.accumulator = 0;

    this.fields = new Fields(preset, this.width, this.height);
    this.particles = new Particles(preset, this.width, this.height, this.rng);
    this.replicator = preset.replicator
      ? new Replicator(preset, this.width, this.height, this.rng)
      : null;
    this.metrics = new Metrics(preset, this.particles.typeCountsSnapshot(), this.replicator);

    this.showGrid = preset.render.showGrid;
    this.showFieldHeatmap = true;
    this.gridStep = preset.render.gridStep;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    return this.showGrid;
  }

  toggleFieldHeatmap() {
    this.showFieldHeatmap = !this.showFieldHeatmap;
    return this.showFieldHeatmap;
  }

  /** Advance one fixed simulation tick. */
  tick() {
    this.tickCount += 1;
    this.simTime += this.dt;

    this.fields.step(this.dt, this.particles);
    const particleEvents = this.particles.step(this.dt, this.fields, this.rng);

    let replicatorEvents = null;
    if (this.replicator) {
      replicatorEvents = this.replicator.step(this.dt, this.fields, this.particles, this.rng);
    }

    this.metrics.record(
      this.tickCount,
      this.simTime,
      this.particles,
      particleEvents,
      this.replicator,
      replicatorEvents,
    );
  }

  /**
   * Accumulate real frame time and run fixed substeps.
   * @param {number} frameDt seconds
   */
  stepFrame(frameDt) {
    if (this.paused) return;
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= this.dt && steps < this.maxSubsteps) {
      this.tick();
      this.accumulator -= this.dt;
      steps += 1;
    }
    if (steps >= this.maxSubsteps) {
      this.accumulator = Math.min(this.accumulator, this.dt);
    }
  }
}
