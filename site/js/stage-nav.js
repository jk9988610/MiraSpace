/**
 * Single-page stage navigation: 5 tabs mapping stage0/2/3/4/5-default presets.
 * Switch resets world (no cross-stage state); preserves seed; syncs URL.
 */

import { STAGES } from "./biology-names.js";

/** @typedef {{ id: string, preset: string, label: string, subtitle: string, hudStages: string[] }} StageTab */

/** @type {StageTab[]} */
export const STAGE_TABS = [
  {
    id: "stage0",
    preset: "stage0-default",
    label: "前生物化学",
    subtitle: "代谢场 · 酶 · 二聚体",
    hudStages: ["s1"],
  },
  {
    id: "stage2",
    preset: "stage2-default",
    label: "遗传复制",
    subtitle: "核酸样聚合物 · 自然选择",
    hudStages: ["s1", "s2"],
  },
  {
    id: "stage3",
    preset: "stage3-default",
    label: "原细胞",
    subtitle: "细胞膜 · 胞质封装 · 分裂",
    hudStages: ["s1", "s2", "s3"],
  },
  {
    id: "stage4",
    preset: "stage4-default",
    label: "整合细胞",
    subtitle: "代谢·膜·遗传耦合",
    hudStages: ["s1", "s2", "s3", "s4"],
  },
  {
    id: "stage5",
    preset: "stage5-default",
    label: "多细胞生物",
    subtitle: "细胞黏附 · 分工 · 发育",
    hudStages: ["s1", "s2", "s3", "s4", "s5"],
  },
];

/**
 * @param {string} presetName
 * @returns {StageTab | null}
 */
export function tabForPreset(presetName) {
  const normalized = presetName.replace(/\.json$/, "");
  return STAGE_TABS.find((t) => t.preset === normalized) ?? null;
}

/**
 * @param {URLSearchParams} params
 */
export function hasPresetInUrl(params) {
  const raw = params.get("preset");
  return raw != null && raw !== "";
}

/**
 * @param {URLSearchParams} params
 * @returns {StageTab | null} null when URL has no preset (await user choice)
 */
export function parseStageFromUrl(params) {
  if (!hasPresetInUrl(params)) return null;
  const preset = params.get("preset").replace(/\.json$/, "");
  return tabForPreset(preset) ?? STAGE_TABS[0];
}

/**
 * @param {number} seed
 * @param {string} presetName
 * @param {number} [timeScale]
 */
export function syncStageUrl(seed, presetName, timeScale = 1) {
  const params = new URLSearchParams();
  params.set("seed", String(seed));
  params.set("preset", presetName.replace(/\.json$/, ""));
  if (timeScale > 1) params.set("timeScale", String(timeScale));
  const url = `${window.location.pathname}?${params.toString()}`;
  history.replaceState({ seed, preset: presetName, timeScale }, "", url);
}

/**
 * Show/hide HUD metric groups for the active stage tab.
 * @param {StageTab} tab
 */
export function applyHudVisibility(tab) {
  const hud = document.getElementById("hud");
  if (!hud) return;

  const active = new Set(tab.hudStages);
  for (const el of hud.querySelectorAll("[data-stage]")) {
    const stage = el.getAttribute("data-stage");
    if (stage) el.hidden = !active.has(stage);
  }

  hud.classList.remove("hud--wide", "hud--s3", "hud--s4", "hud--s5");
  if (active.has("s5")) hud.classList.add("hud--s5");
  else if (active.has("s4")) hud.classList.add("hud--s4");
  else if (active.has("s3")) hud.classList.add("hud--s3");
  else if (active.has("s2")) hud.classList.add("hud--wide");

  const stageLabel = document.getElementById("hud-stage");
  if (stageLabel) {
    const parts = [];
    if (active.has("s1")) parts.push(STAGES.s1.zh);
    if (active.has("s2")) parts.push(STAGES.s2.zh);
    if (active.has("s3")) parts.push(STAGES.s3.zh);
    if (active.has("s4")) parts.push(STAGES.s4.zh);
    if (active.has("s5")) parts.push(STAGES.s5.zh);
    stageLabel.textContent = parts.join(" · ") || STAGES.s1.zh;
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ getActiveTab: () => StageTab, onSelect: (tab: StageTab) => void | Promise<void> }} handlers
 */
export function createStageNav(container, handlers) {
  container.classList.add("stage-nav");
  container.setAttribute("role", "tablist");
  container.setAttribute("aria-label", "科学阶段");

  const tabsEl = document.createElement("div");
  tabsEl.className = "stage-nav__tabs";
  container.appendChild(tabsEl);

  const toastEl = document.createElement("div");
  toastEl.className = "stage-nav__toast";
  toastEl.hidden = true;
  container.appendChild(toastEl);

  /** @type {HTMLButtonElement[]} */
  const buttons = [];

  for (const tab of STAGE_TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stage-nav__tab";
    btn.setAttribute("role", "tab");
    btn.dataset.stageId = tab.id;
    btn.dataset.preset = tab.preset;
    btn.title = tab.subtitle;
    btn.innerHTML = `<span class="stage-nav__label">${tab.label}</span>`
      + `<span class="stage-nav__subtitle">${tab.subtitle}</span>`;
    btn.addEventListener("click", () => {
      const current = handlers.getActiveTab();
      if (current && current.id === tab.id) return;
      void handlers.onSelect(tab);
    });
    tabsEl.appendChild(btn);
    buttons.push(btn);
  }

  /** @param {StageTab | null} tab */
  function setActiveTab(tab) {
    for (const btn of buttons) {
      const isActive = tab != null && btn.dataset.stageId === tab.id;
      btn.classList.toggle("stage-nav__tab--active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    }
  }

  /** @param {string} message */
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }
  showToast._timer = 0;

  return { setActiveTab, showToast };
}
