import { Camera, createRng } from "./camera.js";
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
import { createSimClock, parseTimeScaleFromUrl } from "./sim-clock.js";
import { createControlPanel } from "./control-panel.js";
import { createMilestoneToast } from "./milestone-toast.js";
import { createMilestoneTracker } from "./milestone-tracker.js";
import { buildSnapshotNarrative, buildSnapshotText } from "./data-export.js";
import { createSnapshotModal } from "./snapshot-modal.js";
import { createMagnifierModal } from "./magnifier-modal.js";
import { createUiGuide, createSimObserver, particleLegendBroadcastLines } from "./ui-guide.js";
import { createConditionsTree } from "./conditions-tree.js";
import { createInitPicker } from "./init-picker.js";
import { applyHudBiologyLabels } from "./biology-names.js";

applyHudBiologyLabels();

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("world-canvas");
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d", { alpha: false });

const portraitOverlay = document.getElementById("portrait-overlay");
const initPickerContainer = document.getElementById("init-picker");
const stageNavContainer = document.getElementById("stage-nav");
const controlPanelContainer = document.getElementById("control-panel");

/** Ensure danmaku layer exists (tolerates stale HTML without #danmaku-layer). */
function ensureDanmakuLayer() {
  let el = document.getElementById("danmaku-layer");
  if (el) return el;

  el = document.createElement("div");
  el.id = "danmaku-layer";
  el.setAttribute("aria-live", "polite");
  const canvasEl = document.getElementById("world-canvas");
  if (canvasEl?.parentNode) {
    canvasEl.parentNode.insertBefore(el, canvasEl.nextSibling);
  } else {
    document.body.appendChild(el);
  }
  return el;
}

const danmakuLayer = ensureDanmakuLayer();
const uiGuidePanel = document.getElementById("ui-guide-panel");
const snapshotModalContainer = document.getElementById("snapshot-modal");
const magnifierModalContainer = document.getElementById("magnifier-modal");
const conditionsTreeContainer = document.getElementById("conditions-tree");
const hud = document.getElementById("hud");
const hudStage = document.getElementById("hud-stage");
const hudPreset = document.getElementById("hud-preset");
const hudTick = document.getElementById("hud-tick");
const hudTime = document.getElementById("hud-time");
const hudParticles = document.getElementById("hud-particles");
const hudRowAtmosphere = document.getElementById("hud-row-atmosphere");
const hudGlobalO2 = document.getElementById("hud-global-o2");
const hudGlobalCO2 = document.getElementById("hud-global-co2");
const hudTrophicRichness = document.getElementById("hud-trophic-richness");
const hudPhenotypicArch = document.getElementById("hud-phenotypic-arch");
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
const hudEarth = document.getElementById("hud-earth");
const hudO2Rise = document.getElementById("hud-o2-rise");
const hudO2RiseAvg = document.getElementById("hud-o2-rise-avg");
const hudTrophic = document.getElementById("hud-trophic");
const hudCyanophyte = document.getElementById("hud-cyanophyte");
const hudHeterotroph = document.getElementById("hud-heterotroph");
const hudPhenoRich = document.getElementById("hud-pheno-rich");
const sparkO2Rise = document.getElementById("spark-o2-rise");
const sparkTrophic = document.getElementById("spark-trophic");
const sparkCyanophyte = document.getElementById("spark-cyanophyte");
const sparkHeterotroph = document.getElementById("spark-heterotroph");
const sparkPhenoRich = document.getElementById("spark-pheno-rich");

/** @type {World | null} */
let world = null;
/** @type {Camera | null} */
let camera = null;
/** @type {object | null} */
let presetRef = null;
let presetName = "stage0-default";
let currentSeed = 42;
/** @type {import('./stage-nav.js').STAGE_TABS[number] | null} */
let activeTab = null;
let stageReady = false;
let dpr = 1;
/** @type {ReturnType<typeof createSimClock>} */
let simClock = createSimClock({ timeScale: 1 });
/** @type {ReturnType<typeof createStageNav> | null} */
let stageNav = null;
/** @type {ReturnType<typeof createControlPanel> | null} */
let controlPanel = null;
/** @type {ReturnType<typeof createMilestoneToast> | null} */
let milestoneToast = null;
/** @type {ReturnType<typeof createMilestoneTracker> | null} */
let milestoneTracker = null;
/** @type {ReturnType<typeof createUiGuide> | null} */
let uiGuide = null;
/** @type {ReturnType<typeof createSimObserver> | null} */
let simObserver = null;
/** @type {ReturnType<typeof createInitPicker> | null} */
let initPicker = null;
/** @type {ReturnType<typeof createSnapshotModal> | null} */
let snapshotModal = null;
let magnifierModal = null;
let magnifierMode = false;
/** @type {ReturnType<typeof createConditionsTree> | null} */
let conditionsTree = null;
let snapshotAutoPaused = false;
let frameStarted = false;

function getGuideContext() {
  if (!world || !activeTab) return null;
  const m = world.metrics.formatHud();
  return {
    stageLabel: activeTab.label,
    presetName,
    seed: currentSeed,
    simTime: world.simTime,
    tickCount: world.tickCount,
    timeScale: simClock.timeScale,
    paused: simClock.paused,
    hudStage: hudStage?.textContent ?? "",
    particleCount: world.particles.count(),
    strandCount: world.replicator?.count() ?? null,
    vesicleCount: world.vesicle?.count() ?? null,
    colonyCount: world.colony?.count() ?? null,
    metrics: m,
  };
}

/** @param {string} message */
function logGuide(message) {
  uiGuide?.pushLive(message);
}

function getSnapshotContext() {
  if (!world || !activeTab) return null;
  return {
    presetName,
    stageLabel: activeTab.label,
    seed: currentSeed,
    simTime: world.simTime,
    tickCount: world.tickCount,
    timeScale: simClock.timeScale,
    paused: simClock.paused,
    metrics: world.metrics.formatHud(),
    world,
  };
}

function openSnapshot() {
  const ctx = getSnapshotContext();
  if (!ctx || !snapshotModal) return;
  if (snapshotModal.isOpen()) return;

  snapshotAutoPaused = false;
  if (!simClock.paused) {
    simClock.paused = true;
    snapshotAutoPaused = true;
    syncControlPanelUi();
  }

  const narrative = buildSnapshotNarrative(ctx);
  const copyText = buildSnapshotText(ctx);

  snapshotModal.show(narrative, {
    copyText,
    onClose: () => {
      if (snapshotAutoPaused) {
        simClock.resume();
        snapshotAutoPaused = false;
        syncControlPanelUi();
      }
      logGuide("关闭快照");
    },
  });
  logGuide("打开快照（已暂停模拟）");
}

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
  const rng = createRng((w.seed + 7919) >>> 0);
  cam.camX = rng.range(0, w.width);
  cam.camY = rng.range(0, w.height);
  const fitZoom = Math.min(cam.viewportW / w.width, cam.viewportH / w.height) * 0.92;
  cam.zoom = Math.max(0.85, Math.min(1.4, fitZoom));
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

  if (w.fields.ecologyEnabled && hudRowAtmosphere && !hudRowAtmosphere.hidden) {
    if (hudGlobalO2) hudGlobalO2.textContent = w.fields.globalO2.toFixed(3);
    if (hudGlobalCO2) hudGlobalCO2.textContent = w.fields.globalCO2.toFixed(3);
    if (hudTrophicRichness) {
      hudTrophicRichness.textContent = String(m.trophicRichness ?? 0);
    }
    if (hudPhenotypicArch) {
      hudPhenotypicArch.textContent = String(m.phenotypicArchetypeRichness ?? 0);
    }
  }

  if (w.metrics.earthEnabled && hudEarth && !hudEarth.hidden) {
    const earth = presetRef.metricsThresholdsEarth;
    const o2Rise = m.globalO2Rise ?? 0;
    const trophic = m.trophicRichness ?? 0;
    const cyan = m.cyanophytePresence ?? 0;
    const hetero = m.heterotrophPresence ?? 0;
    const phenoRich = m.phenotypicArchetypeRichness ?? 0;

    if (hudO2Rise) hudO2Rise.textContent = o2Rise.toFixed(3);
    if (hudO2RiseAvg) hudO2RiseAvg.textContent = `avg ${(m.globalO2Avg ?? m.globalO2Level ?? 0).toFixed(3)}`;
    if (hudTrophic) hudTrophic.textContent = String(trophic);
    if (hudCyanophyte) hudCyanophyte.textContent = cyan >= 1 ? "是" : "否";
    if (hudHeterotroph) hudHeterotroph.textContent = hetero >= 1 ? "是" : "否";
    if (hudPhenoRich) hudPhenoRich.textContent = String(phenoRich);

    drawSparkline(sparkO2Rise, w.metrics.getSparklineSeriesEarth("globalO2Rise"), {
      color: "#7fd4a8",
      threshold: earth?.globalO2Rise,
    });
    drawSparkline(sparkTrophic, w.metrics.getSparklineSeriesEarth("trophicRichness"), {
      color: "#8ec8ff",
      threshold: earth?.trophicRichness,
    });
    drawSparkline(sparkCyanophyte, w.metrics.getSparklineSeriesEarth("cyanophytePresence"), {
      color: "#a8e6cf",
      threshold: earth?.cyanophytePresence,
    });
    drawSparkline(sparkHeterotroph, w.metrics.getSparklineSeriesEarth("heterotrophPresence"), {
      color: "#ffd3a5",
      threshold: earth?.heterotrophPresence,
    });
    drawSparkline(sparkPhenoRich, w.metrics.getSparklineSeriesEarth("phenotypicArchetypeRichness"), {
      color: "#c5b3ff",
    });
  }

  milestoneTracker?.check(m, presetRef);
  simObserver?.observe(w, w.tickCount);
  if (uiGuide?.isOpen()) {
    uiGuide.updateStatic();
  }
  if (conditionsTree?.isOpen()) {
    conditionsTree.render();
  }
}

function syncUrl() {
  if (!stageReady || !activeTab) return;
  syncStageUrl(currentSeed, presetName, simClock.timeScale);
}

function setAppPending(pending) {
  document.body.classList.toggle("app-shell--pending", pending);
}

function syncControlPanelUi() {
  if (!world || !controlPanel) return;
  controlPanel.syncUi({
    paused: simClock.paused,
    timeScale: simClock.timeScale,
    showGrid: world.showGrid,
    showField: world.showFieldHeatmap,
    fieldHeatmapMode: world.fieldHeatmapMode,
    magnifierMode,
    earthStage: !!world.earthProfile,
  });
}

/**
 * @param {number} seed
 * @param {{ resetPause?: boolean }} [opts]
 */
function initWorld(seed, opts = {}) {
  world = new World(presetRef, seed);
  currentSeed = seed;

  if (opts.resetPause !== false) {
    simClock.resume();
  }

  if (!camera) {
    camera = new Camera(world.width, world.height);
    camera.attachPanHandlers(canvas);
  } else {
    resetCameraCenter(camera, world);
  }
  resizeCanvas();
  syncControlPanelUi();
  milestoneTracker?.reset();
  simObserver?.reset();
}

/** @param {World} w */
function renderWorld(w) {
  drawBackground();
  drawGrid(camera, w);
  if (w.earthProfile) {
    w.earthProfile.drawZoneBands(ctx, camera);
  }
  if (w.showFieldHeatmap && w.fieldHeatmapMode !== "off") {
    w.fields.drawHeatmap(ctx, camera, w.fieldHeatmapMode);
  }
  w.particles.draw(ctx, camera);
  if (w.replicator) {
    w.replicator.draw(ctx, camera);
  }
  if (w.vesicle && w.replicator) {
    if (w.colony) {
      w.colony.drawEnvelope(ctx, camera, w.vesicle);
    }
    w.vesicle.draw(ctx, camera, w.replicator);
  }
}

function frame() {
  requestAnimationFrame(frame);

  if (!world || !camera || !isLandscape() || !stageReady) {
    return;
  }

  simClock.stepFrame(world);
  renderWorld(world);
  updateHud(world);
}

/**
 * @param {import('./stage-nav.js').STAGE_TABS[number]} tab
 * @param {{ toast?: boolean, fromPicker?: boolean }} [opts]
 */
async function startStage(tab, opts = {}) {
  const firstStart = !stageReady;
  presetName = tab.preset;
  activeTab = tab;
  stageReady = true;
  setAppPending(false);
  initPicker?.hide();

  presetRef = await loadPreset(presetName);
  presetRef._name = presetName;

  initWorld(currentSeed, { resetPause: true });

  applyHudVisibility(tab);
  stageNav?.setActiveTab(tab);
  syncUrl();

  if (opts.toast) {
    stageNav?.showToast(`已切换至：${tab.label}`);
  }
  if (firstStart) {
    logGuide(`开始阶段：${tab.label}（${tab.preset}）`);
  } else {
    logGuide(`切换阶段：${tab.label}（${tab.preset}）`);
  }

  uiGuide?.broadcastStageLegend?.();
  milestoneToast?.show(`里程碑弹幕已开启 · ${tab.label}`);
  const legendPreview = particleLegendBroadcastLines(tab.stageKey).slice(0, 2).join(" · ");
  milestoneToast?.show(legendPreview);

  if (!frameStarted) {
    frameStarted = true;
    requestAnimationFrame(frame);
  }
}

async function resetCurrentRun() {
  if (!stageReady || !activeTab) return;
  initWorld(currentSeed, { resetPause: true });
  syncUrl();
  logGuide("重置当前 run（同 preset + seed）");
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  simClock = createSimClock({ timeScale: parseTimeScaleFromUrl(params) });
  currentSeed = parseSeedFromUrl(42);

  stageNav = createStageNav(stageNavContainer, {
    getActiveTab: () => activeTab,
    onSelect: async (tab) => {
      await startStage(tab, { toast: stageReady });
    },
  });

  initPicker = createInitPicker(initPickerContainer, {
    onSelect: async (tab) => {
      await startStage(tab, { fromPicker: true });
    },
  });

  milestoneToast = createMilestoneToast(danmakuLayer);

  milestoneTracker = createMilestoneTracker({
    onMilestone: (msg) => {
      milestoneToast?.show(msg);
      logGuide(msg);
    },
  });

  simObserver = createSimObserver((msg) => logGuide(msg));

  controlPanel = createControlPanel(controlPanelContainer, {
    getTimeScale: () => simClock.timeScale,
    onPauseToggle: () => {
      simClock.togglePause();
      syncControlPanelUi();
      logGuide(simClock.paused ? "暂停模拟" : "继续模拟");
    },
    onTimeScale: (scale) => {
      simClock.setTimeScale(scale);
      syncUrl();
      syncControlPanelUi();
      logGuide(`时间倍率：${scale}×`);
    },
    onGridToggle: () => {
      if (!world) return;
      world.toggleGrid();
      syncControlPanelUi();
      logGuide(world.showGrid ? "开启网格" : "关闭网格");
    },
    onFieldToggle: () => {
      if (!world) return;
      const mode = world.toggleFieldHeatmap();
      syncControlPanelUi();
      const labels = {
        drive: "热力图：能量梯度驱动（单体被拉向亮区）",
        energy: "热力图：能量场浓度",
        waste: "热力图：废物场（越高阻力越大）",
        light: "热力图：光照（剖面日照）",
        off: "热力图：关闭",
      };
      logGuide(labels[mode] ?? "热力图切换");
    },
    onReset: () => {
      void resetCurrentRun();
    },
    onSnapshot: () => {
      openSnapshot();
    },
    onMagnifierToggle: () => {
      magnifierMode = !magnifierMode;
      syncControlPanelUi();
      logGuide(magnifierMode ? "放大镜：点击画布查看微观" : "放大镜：关闭");
      if (!magnifierMode) magnifierModal?.close();
    },
  });

  uiGuide = createUiGuide(uiGuidePanel, controlPanel.btnGuide, {
    getContext: getGuideContext,
    getStageKey: () => activeTab?.stageKey ?? null,
  });

  conditionsTree = createConditionsTree(conditionsTreeContainer, controlPanel.btnConditions, {
    getContext: () => {
      if (!world || !activeTab || !presetRef) return null;
      return {
        metrics: world.metrics.formatHud(),
        preset: presetRef,
        achieved: milestoneTracker?.getAchieved() ?? new Set(),
        activeHudStages: activeTab.hudStages,
        stageLabel: activeTab.label,
      };
    },
  });

  snapshotModal = createSnapshotModal(snapshotModalContainer);
  magnifierModal = createMagnifierModal(magnifierModalContainer);

  let magnifierPointer = { x: 0, y: 0, moved: false };
  canvas.addEventListener("pointerdown", (e) => {
    magnifierPointer = { x: e.clientX, y: e.clientY, moved: false };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (Math.hypot(e.clientX - magnifierPointer.x, e.clientY - magnifierPointer.y) > 10) {
      magnifierPointer.moved = true;
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!magnifierMode || magnifierPointer.moved || !world || !camera) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = camera.screenToWorld(sx, sy);
    magnifierModal?.showAt(world, wx, wy);
  });

  const deepLinkTab = parseStageFromUrl(params);
  if (deepLinkTab) {
    await startStage(deepLinkTab);
  } else {
    stageNav.setActiveTab(null);
    initPicker.show();
    setAppPending(true);
  }

  window.addEventListener("resize", () => {
    updateOrientationOverlay();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(updateOrientationOverlay, 100);
  });

  updateOrientationOverlay();
}

main().catch((err) => {
  console.error(err);
  portraitOverlay.hidden = false;
  portraitOverlay.querySelector(".portrait-overlay__content").innerHTML =
    `<h1>MiraSpace</h1><p>加载失败：${err.message}</p>`;
});
