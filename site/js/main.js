import { Camera } from "./camera.js";
import { World } from "./world.js";
import { drawSparkline } from "./sparkline.js";
import { loadPreset } from "./preset.js";
import {
  STAGE_TABS,
  applyHudVisibility,
  createStageNav,
  parseStageFromUrl,
  syncStageUrl,
} from "./stage-nav.js";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("world-canvas");
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d", { alpha: false });

const portraitOverlay = document.getElementById("portrait-overlay");
const stageNavContainer = document.getElementById("stage-nav");
const hud = document.getElementById("hud");
const hudStage = document.getElementById("hud-stage");
const hudPreset = document.getElementById("hud-preset");
const hudTick = document.getElementById("hud-tick");
const hudTime = document.getElementById("hud-time");
const hudParticles = document.getElementById("hud-particles");
const hudSeed = document.getElementById("hud-seed");
const hudRowStrands = document.getElementById("hud-row-strands");
const hudStrands = document.getElementById("hud-strands");
const hudS2 = document.getElementById("hud-s2");
const hudCluster = document.getElementById("hud-cluster");
const hudClusterAvg = document.getElementById("hud-cluster-avg");
const hudAutocat = document.getElementById("hud-autocat");
const hudAutocatAvg = document.getElementById("hud-autocat-avg");
const hudNegentropy = document.getElementById("hud-negentropy");
const hudNegentropyAvg = document.getElementById("hud-negentropy-avg");
const sparkCluster = document.getElementById("spark-cluster");
const sparkAutocat = document.getElementById("spark-autocat");
const sparkNegentropy = document.getElementById("spark-negentropy");
const hudHeritability = document.getElementById("hud-heritability");
const hudHeritabilityAvg = document.getElementById("hud-heritability-avg");
const hudSweep = document.getElementById("hud-sweep");
const hudSweepAvg = document.getElementById("hud-sweep-avg");
const hudInfo = document.getElementById("hud-info");
const hudInfoAvg = document.getElementById("hud-info-avg");
const hudParasite = document.getElementById("hud-parasite");
const sparkHeritability = document.getElementById("spark-heritability");
const sparkSweep = document.getElementById("spark-sweep");
const sparkInfo = document.getElementById("spark-info");
const sparkParasite = document.getElementById("spark-parasite");
const hudS3 = document.getElementById("hud-s3");
const hudRowVesicles = document.getElementById("hud-row-vesicles");
const hudVesicles = document.getElementById("hud-vesicles");
const hudVesicleMetric = document.getElementById("hud-vesicle-metric");
const hudEncap = document.getElementById("hud-encap");
const hudEncapAvg = document.getElementById("hud-encap-avg");
const hudParasiteLoad = document.getElementById("hud-parasite-load");
const hudParasiteLoadAvg = document.getElementById("hud-parasite-load-avg");
const hudFission = document.getElementById("hud-fission");
const sparkEncap = document.getElementById("spark-encap");
const sparkParasiteLoad = document.getElementById("spark-parasite-load");
const sparkFission = document.getElementById("spark-fission");
const sparkVesicleCount = document.getElementById("spark-vesicle-count");
const hudS4 = document.getElementById("hud-s4");
const hudCoherence = document.getElementById("hud-coherence");
const hudCoherenceAvg = document.getElementById("hud-coherence-avg");
const hudLineage = document.getElementById("hud-lineage");
const hudLineageAvg = document.getElementById("hud-lineage-avg");
const hudStorage = document.getElementById("hud-storage");
const hudChemotonCount = document.getElementById("hud-chemoton-count");
const sparkCoherence = document.getElementById("spark-coherence");
const sparkLineage = document.getElementById("spark-lineage");
const sparkStorage = document.getElementById("spark-storage");
const sparkChemotonCount = document.getElementById("spark-chemoton-count");
const hudS5 = document.getElementById("hud-s5");
const hudPersistence = document.getElementById("hud-persistence");
const hudPersistenceAvg = document.getElementById("hud-persistence-avg");
const hudLabor = document.getElementById("hud-labor");
const hudLaborAvg = document.getElementById("hud-labor-avg");
const hudPattern = document.getElementById("hud-pattern");
const hudPatternAvg = document.getElementById("hud-pattern-avg");
const hudColonyCount = document.getElementById("hud-colony-count");
const sparkPersistence = document.getElementById("spark-persistence");
const sparkLabor = document.getElementById("spark-labor");
const sparkPattern = document.getElementById("spark-pattern");
const sparkColonyCount = document.getElementById("spark-colony-count");
const btnPause = document.getElementById("btn-pause");
const btnGrid = document.getElementById("btn-grid");
const btnField = document.getElementById("btn-field");

/** @type {World | null} */
let world = null;
/** @type {Camera | null} */
let camera = null;
/** @type {object | null} */
let presetRef = null;
let presetName = "stage0-default";
let currentSeed = 42;
/** @type {import('./stage-nav.js').STAGE_TABS[number]} */
let activeTab = STAGE_TABS[0];
let dpr = 1;
let lastFrameTime = performance.now();
/** @type {ReturnType<typeof createStageNav> | null} */
let stageNav = null;

function parseSeedFromUrl(defaultSeed) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("seed");
  if (raw == null || raw === "") return defaultSeed;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultSeed;
}

function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

function updateOrientationOverlay() {
  const landscape = isLandscape();
  portraitOverlay.hidden = landscape;
  if (landscape) {
    resizeCanvas();
  }
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (camera) {
    camera.setViewport(cssW, cssH);
  }
}

/**
 * @param {import('./camera.js').Camera} cam
 * @param {World} w
 */
function resetCameraCenter(cam, w) {
  cam.worldWidth = w.width;
  cam.worldHeight = w.height;
  cam.camX = w.width / 2;
  cam.camY = w.height / 2;
}

function drawBackground() {
  ctx.fillStyle = "#050810";
  ctx.fillRect(0, 0, camera.viewportW, camera.viewportH);
}

/**
 * @param {import('./camera.js').Camera} cam
 * @param {World} w
 */
function drawGrid(cam, w) {
  if (!w.showGrid) return;

  const step = w.gridStep;
  const bounds = cam.getViewBounds();
  const startX = Math.floor(bounds.left / step) * step;
  const endX = Math.ceil(bounds.right / step) * step;
  const startY = Math.floor(bounds.bottom / step) * step;
  const endY = Math.ceil(bounds.top / step) * step;

  ctx.strokeStyle = "rgba(80, 110, 140, 0.18)";
  ctx.lineWidth = 1;

  for (let wx = startX; wx <= endX; wx += step) {
    const top = cam.worldToScreen(wx, bounds.top);
    const bottom = cam.worldToScreen(wx, bounds.bottom);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }

  for (let wy = startY; wy <= endY; wy += step) {
    const left = cam.worldToScreen(bounds.left, wy);
    const right = cam.worldToScreen(bounds.right, wy);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
}

/** @param {World} w */
function updateHud(w) {
  hudTick.textContent = String(w.tickCount);
  hudTime.textContent = `${w.simTime.toFixed(1)} s`;
  hudParticles.textContent = String(w.particles.count());
  hudSeed.textContent = String(w.seed);
  hudPreset.textContent = presetName;

  const m = w.metrics.formatHud();
  const s1 = presetRef.metricsThresholds;

  hudCluster.textContent = m.clusterIndex.toFixed(2);
  hudClusterAvg.textContent = `avg ${m.clusterAvg.toFixed(2)}`;
  hudAutocat.textContent = m.autocatalyticScore.toFixed(2);
  hudAutocatAvg.textContent = `avg ${m.autocatalyticAvg.toFixed(2)}`;
  hudNegentropy.textContent = m.negentropyFlux.toFixed(2);
  hudNegentropyAvg.textContent = `avg ${m.negentropyAvg.toFixed(2)}`;

  drawSparkline(sparkCluster, w.metrics.getSparklineSeries("clusterIndex"), {
    color: "#8ec8ff",
    threshold: s1.clusterIndex,
  });
  drawSparkline(sparkAutocat, w.metrics.getSparklineSeries("autocatalyticScore"), {
    color: "#e8b44d",
    threshold: s1.autocatalyticScore,
  });
  drawSparkline(sparkNegentropy, w.metrics.getSparklineSeries("negentropyFlux"), {
    color: "#7fd4a8",
    threshold: s1.negentropyFluxRatio,
  });

  if (w.replicator && !hudS2.hidden) {
    hudStrands.textContent = String(m.strandCount ?? 0);

    const s2 = presetRef.metricsThresholdsS2;
    hudHeritability.textContent = m.heritability.toFixed(2);
    hudHeritabilityAvg.textContent = `avg ${m.heritabilityAvg.toFixed(2)}`;
    hudSweep.textContent = m.selectiveSweep.toFixed(2);
    hudSweepAvg.textContent = `avg ${m.selectiveSweepAvg.toFixed(2)}`;
    hudInfo.textContent = m.informationAccumulation.toFixed(2);
    hudInfoAvg.textContent = `avg ${m.informationAccumulationAvg.toFixed(2)}`;
    hudParasite.textContent = m.parasiteFraction.toFixed(2);

    drawSparkline(sparkHeritability, w.metrics.getSparklineSeriesS2("heritability"), {
      color: "#d4a5ff",
      threshold: s2.heritability,
    });
    drawSparkline(sparkSweep, w.metrics.getSparklineSeriesS2("selectiveSweep"), {
      color: "#ff9f7a",
      threshold: s2.selectiveSweepTopShare,
    });
    drawSparkline(sparkInfo, w.metrics.getSparklineSeriesS2("informationAccumulation"), {
      color: "#89f0c2",
      threshold: s2.informationAccumulationRatio,
    });
    drawSparkline(sparkParasite, w.metrics.getSparklineSeriesS2("parasiteFraction"), {
      color: "#ff6b8a",
    });
  }

  if (w.vesicle && !hudS3.hidden) {
    const s3 = presetRef.metricsThresholdsS3;
    hudVesicles.textContent = String(m.vesicleCount ?? 0);
    if (hudVesicleMetric) hudVesicleMetric.textContent = String(m.vesicleCount ?? 0);
    hudEncap.textContent = (m.encapsulationGain ?? 1).toFixed(2);
    hudEncapAvg.textContent = `avg ${(m.encapsulationGainAvg ?? 1).toFixed(2)}`;
    hudParasiteLoad.textContent = (m.parasiteLoad ?? 1).toFixed(2);
    hudParasiteLoadAvg.textContent = `avg ${(m.parasiteLoadAvg ?? 1).toFixed(2)}`;
    hudFission.textContent = String(m.fissionEvents ?? 0);

    drawSparkline(sparkEncap, w.metrics.getSparklineSeriesS3("encapsulationGain"), {
      color: "#7ec8ff",
      threshold: s3?.encapsulationGain,
    });
    drawSparkline(sparkParasiteLoad, w.metrics.getSparklineSeriesS3("parasiteLoad"), {
      color: "#ffb07a",
      threshold: s3?.parasiteLoadMax,
    });
    drawSparkline(sparkFission, w.metrics.getSparklineSeriesS3("fissionEvents"), {
      color: "#b8ff9a",
      threshold: s3?.fissionEventsPer300s,
    });
    drawSparkline(sparkVesicleCount, w.metrics.getSparklineSeriesS3("vesicleCount"), {
      color: "#a0c4ff",
    });
  }

  if (w.chemoton && !hudS4.hidden) {
    const s4 = presetRef.metricsThresholdsS4;
    hudCoherence.textContent = (m.chemotonCoherence ?? 0).toFixed(2);
    hudCoherenceAvg.textContent = `avg ${(m.chemotonCoherenceAvg ?? 0).toFixed(2)}`;
    hudLineage.textContent = (m.lineagePersistence ?? 0).toFixed(2);
    hudLineageAvg.textContent = `avg ${(m.lineagePersistenceAvg ?? 0).toFixed(2)}`;
    hudStorage.textContent = (m.storageFidelity ?? 1).toFixed(2);
    hudChemotonCount.textContent = String(m.chemotonCount ?? 0);

    drawSparkline(sparkCoherence, w.metrics.getSparklineSeriesS4("chemotonCoherence"), {
      color: "#c9a0ff",
      threshold: s4?.chemotonCoherence,
    });
    drawSparkline(sparkLineage, w.metrics.getSparklineSeriesS4("lineagePersistence"), {
      color: "#ffd48a",
      threshold: s4?.lineagePersistenceGenerations,
    });
    drawSparkline(sparkStorage, w.metrics.getSparklineSeriesS4("storageFidelity"), {
      color: "#9effc8",
    });
    drawSparkline(sparkChemotonCount, w.metrics.getSparklineSeriesS4("chemotonCount"), {
      color: "#88b4ff",
    });
  }

  if (w.colony && !hudS5.hidden) {
    const s5 = presetRef.metricsThresholdsS5;
    hudPersistence.textContent = (m.multicellularPersistence ?? 0).toFixed(2);
    hudPersistenceAvg.textContent = `avg ${(m.multicellularPersistenceAvg ?? 0).toFixed(2)}`;
    hudLabor.textContent = (m.divisionOfLabor ?? 0).toFixed(2);
    hudLaborAvg.textContent = `avg ${(m.divisionOfLaborAvg ?? 0).toFixed(2)}`;
    hudPattern.textContent = (m.developmentalPattern ?? 0).toFixed(2);
    hudPatternAvg.textContent = `avg ${(m.developmentalPatternAvg ?? 0).toFixed(2)}`;
    hudColonyCount.textContent = String(m.colonyCount ?? 0);

    drawSparkline(sparkPersistence, w.metrics.getSparklineSeriesS5("multicellularPersistence"), {
      color: "#a8e6cf",
      threshold: s5?.multicellularPersistenceRatio,
    });
    drawSparkline(sparkLabor, w.metrics.getSparklineSeriesS5("divisionOfLabor"), {
      color: "#ffd3a5",
      threshold: s5?.divisionOfLaborColonyShare,
    });
    drawSparkline(sparkPattern, w.metrics.getSparklineSeriesS5("developmentalPattern"), {
      color: "#c5b3ff",
      threshold: s5?.developmentalPatternScore,
    });
    drawSparkline(sparkColonyCount, w.metrics.getSparklineSeriesS5("colonyCount"), {
      color: "#7ec8ff",
    });
  }
}

function frame(now) {
  requestAnimationFrame(frame);

  if (!world || !camera || !isLandscape()) {
    lastFrameTime = now;
    return;
  }

  const frameDt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  world.stepFrame(frameDt);

  drawBackground();
  drawGrid(camera, world);
  if (world.showFieldHeatmap) {
    world.fields.drawHeatmap(ctx, camera);
  }
  world.particles.draw(ctx, camera);
  if (world.replicator) {
    world.replicator.draw(ctx, camera);
  }
  if (world.vesicle && world.replicator) {
    if (world.colony) {
      world.colony.drawLinks(ctx, camera, world.vesicle);
    }
    world.vesicle.draw(ctx, camera, world.replicator);
  }
  updateHud(world);
}

function bindControls() {
  btnPause.addEventListener("click", () => {
    if (!world) return;
    const paused = world.togglePause();
    btnPause.textContent = paused ? "继续" : "暂停";
    btnPause.setAttribute("aria-pressed", String(paused));
  });

  btnGrid.addEventListener("click", () => {
    if (!world) return;
    const on = world.toggleGrid();
    btnGrid.setAttribute("aria-pressed", String(on));
  });

  btnField.addEventListener("click", () => {
    if (!world) return;
    const on = world.toggleFieldHeatmap();
    btnField.setAttribute("aria-pressed", String(on));
  });
}

function resetControlUi(w) {
  world = w;
  world.paused = false;
  world.accumulator = 0;
  btnPause.textContent = "暂停";
  btnPause.setAttribute("aria-pressed", "false");
  btnGrid.setAttribute("aria-pressed", String(w.showGrid));
  btnField.setAttribute("aria-pressed", String(w.showFieldHeatmap));
}

/**
 * Load preset and rebuild world (no cross-stage state).
 * @param {import('./stage-nav.js').STAGE_TABS[number]} tab
 * @param {number} seed
 * @param {{ toast?: boolean }} [opts]
 */
async function switchStage(tab, seed, opts = {}) {
  presetName = tab.preset;
  activeTab = tab;
  currentSeed = seed;

  presetRef = await loadPreset(presetName);
  presetRef._name = presetName;

  const nextWorld = new World(presetRef, seed);
  resetControlUi(nextWorld);

  if (!camera) {
    camera = new Camera(nextWorld.width, nextWorld.height);
    camera.attachPanHandlers(canvas);
    resizeCanvas();
  } else {
    resetCameraCenter(camera, nextWorld);
    resizeCanvas();
  }

  applyHudVisibility(tab);
  syncStageUrl(seed, presetName);
  stageNav?.setActiveTab(tab);
  if (opts.toast) {
    stageNav?.showToast(`已切换至：${tab.label}`);
  }

  lastFrameTime = performance.now();
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  activeTab = parseStageFromUrl(params);
  presetName = activeTab.preset;

  presetRef = await loadPreset(presetName);
  presetRef._name = presetName;
  currentSeed = parseSeedFromUrl(presetRef.sim.seed);

  stageNav = createStageNav(stageNavContainer, {
    getActiveTab: () => activeTab,
    onSelect: async (tab) => {
      await switchStage(tab, currentSeed, { toast: true });
    },
  });

  world = new World(presetRef, currentSeed);
  camera = new Camera(world.width, world.height);

  resizeCanvas();
  camera.attachPanHandlers(canvas);
  bindControls();
  applyHudVisibility(activeTab);
  stageNav.setActiveTab(activeTab);
  syncStageUrl(currentSeed, presetName);

  window.addEventListener("resize", () => {
    updateOrientationOverlay();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(updateOrientationOverlay, 100);
  });

  updateOrientationOverlay();
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  portraitOverlay.hidden = false;
  portraitOverlay.querySelector(".portrait-overlay__content").innerHTML =
    `<h1>MiraSpace</h1><p>加载失败：${err.message}</p>`;
});
