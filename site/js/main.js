import { Camera } from "./camera.js";
import { World } from "./world.js";

const PRESET_URL = "./data/presets/stage0-default.json";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("world-canvas");
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d", { alpha: false });

const portraitOverlay = document.getElementById("portrait-overlay");
const hudTick = document.getElementById("hud-tick");
const hudTime = document.getElementById("hud-time");
const hudParticles = document.getElementById("hud-particles");
const hudCluster = document.getElementById("hud-cluster");
const hudClusterAvg = document.getElementById("hud-cluster-avg");
const hudAutocat = document.getElementById("hud-autocat");
const hudAutocatAvg = document.getElementById("hud-autocat-avg");
const hudNegentropy = document.getElementById("hud-negentropy");
const hudNegentropyAvg = document.getElementById("hud-negentropy-avg");
const btnPause = document.getElementById("btn-pause");
const btnGrid = document.getElementById("btn-grid");
const btnField = document.getElementById("btn-field");

/** @type {World | null} */
let world = null;
/** @type {Camera | null} */
let camera = null;
let dpr = 1;
let lastFrameTime = performance.now();

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

async function loadPreset() {
  const response = await fetch(PRESET_URL);
  if (!response.ok) {
    throw new Error(`Failed to load preset: ${response.status}`);
  }
  return response.json();
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

/**
 * @param {import('./camera.js').Camera} cam
 * @param {World} w
 */
function drawEnergyHeatmap(cam, w) {
  if (!w.showFieldHeatmap) return;

  const fields = w.fields;
  const bounds = cam.getViewBounds();
  const tile = 16;
  const opacity = fields.heatmapOpacity;

  const startX = Math.floor(bounds.left / tile) * tile;
  const endX = Math.ceil(bounds.right / tile) * tile;
  const startY = Math.floor(bounds.bottom / tile) * tile;
  const endY = Math.ceil(bounds.top / tile) * tile;

  for (let wx = startX; wx < endX; wx += tile) {
    for (let wy = startY; wy < endY; wy += tile) {
      const e = fields.sampleEnergy(wx + tile * 0.5, wy + tile * 0.5);
      const r = Math.floor(20 + e * 40);
      const g = Math.floor(40 + e * 120);
      const b = Math.floor(60 + e * 80);
      const a = opacity * (0.35 + e * 0.65);

      const tl = cam.worldToScreen(wx, wy + tile);
      const br = cam.worldToScreen(wx + tile, wy);
      const x = tl.x;
      const y = tl.y;
      const width = br.x - tl.x;
      const height = br.y - tl.y;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      ctx.fillRect(x, y, width, height);
    }
  }
}

function updateHud(w) {
  hudTick.textContent = String(w.tickCount);
  hudTime.textContent = `${w.simTime.toFixed(1)} s`;
  hudParticles.textContent = String(w.particles.count());

  const m = w.metrics.formatHud();
  hudCluster.textContent = m.clusterIndex.toFixed(2);
  hudClusterAvg.textContent = `avg ${m.clusterAvg.toFixed(2)}`;
  hudAutocat.textContent = m.autocatalyticScore.toFixed(2);
  hudAutocatAvg.textContent = `avg ${m.autocatalyticAvg.toFixed(2)}`;
  hudNegentropy.textContent = m.negentropyFlux.toFixed(2);
  hudNegentropyAvg.textContent = `avg ${m.negentropyAvg.toFixed(2)}`;
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
  drawEnergyHeatmap(camera, world);
  world.particles.draw(ctx, camera);
  updateHud(world);
}

function bindControls(w) {
  btnPause.addEventListener("click", () => {
    const paused = w.togglePause();
    btnPause.textContent = paused ? "继续" : "暂停";
    btnPause.setAttribute("aria-pressed", String(paused));
  });

  btnGrid.addEventListener("click", () => {
    const on = w.toggleGrid();
    btnGrid.setAttribute("aria-pressed", String(on));
  });

  btnField.addEventListener("click", () => {
    const on = w.toggleFieldHeatmap();
    btnField.setAttribute("aria-pressed", String(on));
  });
}

async function main() {
  const preset = await loadPreset();
  const seed = parseSeedFromUrl(preset.sim.seed);

  world = new World(preset, seed);
  camera = new Camera(world.width, world.height);

  resizeCanvas();
  camera.attachPanHandlers(canvas);
  bindControls(world);

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
