import { Fields } from "./fields.js";
import { Particles } from "./particles.js";
import { Metrics } from "./metrics.js";
import { Replicator } from "./replicator.js";
import { Vesicle } from "./vesicle.js";
import { Chemoton } from "./chemoton.js";
import { Colony } from "./colony.js";
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
    this.chemoton = preset.chemoton
      ? new Chemoton(preset)
      : null;
    this.vesicle = preset.vesicle
      ? new Vesicle(preset, this.width, this.height, this.rng, this.chemoton)
      : null;
    this.colony = preset.colony
      ? new Colony(preset, this.width, this.height)
      : null;
    if (this.vesicle && this.colony) {
      this.vesicle.colony = this.colony;
    }
    this.metrics = new Metrics(
      preset,
      this.particles.typeCountsSnapshot(),
      this.replicator,
      this.vesicle,
      this.chemoton,
      this.colony,
    );

    this.showGrid = preset.render.showGrid;
    const defaultHeatmap = preset.render?.defaultFieldHeatmap ?? "energy";
    this.fieldHeatmapMode = defaultHeatmap === "off" ? "off" : defaultHeatmap;
    this.showFieldHeatmap = this.fieldHeatmapMode !== "off";
    this.gridStep = preset.render.gridStep;
    this.fieldHeatmapCycle = preset.render?.fieldHeatmapCycle ?? ["drive", "energy", "waste", "off"];
  }

  /** Cycle field overlay modes (preset-configurable). */
  cycleFieldHeatmap() {
    const order = this.fieldHeatmapCycle;
    const idx = order.indexOf(this.fieldHeatmapMode);
    const next = order[(idx >= 0 ? idx + 1 : 0) % order.length];
    this.fieldHeatmapMode = next;
    this.showFieldHeatmap = next !== "off";
    return this.fieldHeatmapMode;
  }

  toggleFieldHeatmap() {
    return this.cycleFieldHeatmap();
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    return this.showGrid;
  }

  /** Advance one fixed simulation tick. */
  tick() {
    this.tickCount += 1;
    this.simTime += this.dt;

    this.fields.step(this.dt, this.particles);
    const particleEvents = this.particles.step(this.dt, this.fields, this.rng);

    let replicatorEvents = null;
    if (this.replicator) {
      if (this.colony && this.vesicle) {
        this.colony.updatePhenotypes(this.vesicle, this.fields, this.replicator);
      }
      if (this.chemoton && this.vesicle) {
        for (const v of this.vesicle.list) {
          this.chemoton.updateMetabolism(
            v,
            this.particles,
            this.fields,
            this.dt,
            this.width,
            this.height,
            this.replicator,
          );
          this.chemoton.applyGeneFlux(
            v,
            this.fields,
            this.replicator,
            this.vesicle,
            this.width,
            this.height,
            this.dt,
          );
        }
      }
      replicatorEvents = this.replicator.step(
        this.dt,
        this.fields,
        this.particles,
        this.rng,
        this.vesicle,
        this.chemoton,
        this.simTime,
      );
    }

    let vesicleEvents = null;
    if (this.vesicle && this.replicator) {
      vesicleEvents = this.vesicle.step(
        this.dt,
        this.fields,
        this.particles,
        this.replicator,
        this.rng,
        this.simTime,
        replicatorEvents,
      );
    }

    if (this.colony && this.vesicle) {
      this.colony.step(this.dt, this.vesicle, this.chemoton);
    }

    this.metrics.record(
      this.tickCount,
      this.simTime,
      this.particles,
      particleEvents,
      this.replicator,
      replicatorEvents,
      this.vesicle,
      vesicleEvents,
      this.chemoton,
      this.colony,
      this.fields,
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
