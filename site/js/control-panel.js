import { TIME_SCALES, normalizeTimeScale } from "./sim-clock.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   getTimeScale: () => number,
 *   onPauseToggle: () => void,
 *   onTimeScale: (scale: 1 | 5 | 20) => void,
 *   onGridToggle: () => void,
 *   onFieldToggle: () => void,
 *   onReset: () => void,
 *   onSnapshot: () => void,
 * }} handlers
 */
export function createControlPanel(container, handlers) {
  container.className = "control-panel";
  container.setAttribute("aria-label", "模拟控制");

  const rowSpeed = document.createElement("div");
  rowSpeed.className = "control-panel__row";

  const btnPause = document.createElement("button");
  btnPause.type = "button";
  btnPause.id = "btn-pause";
  btnPause.className = "control-panel__btn control-panel__btn--pause";
  btnPause.setAttribute("aria-pressed", "false");
  btnPause.title = "暂停 / 继续";
  btnPause.textContent = "⏸";
  btnPause.addEventListener("click", handlers.onPauseToggle);
  rowSpeed.appendChild(btnPause);

  const speedGroup = document.createElement("div");
  speedGroup.className = "control-panel__speeds";
  speedGroup.setAttribute("role", "group");
  speedGroup.setAttribute("aria-label", "时间倍率");

  /** @type {Record<number, HTMLButtonElement>} */
  const speedButtons = {};

  for (const scale of TIME_SCALES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = `speed-${scale}x`;
    btn.className = "control-panel__btn control-panel__btn--speed";
    btn.dataset.timeScale = String(scale);
    btn.textContent = `${scale}×`;
    btn.addEventListener("click", () => {
      handlers.onTimeScale(normalizeTimeScale(scale));
    });
    speedGroup.appendChild(btn);
    speedButtons[scale] = btn;
  }
  rowSpeed.appendChild(speedGroup);
  container.appendChild(rowSpeed);

  const rowView = document.createElement("div");
  rowView.className = "control-panel__row";

  const btnGrid = document.createElement("button");
  btnGrid.type = "button";
  btnGrid.id = "toggle-grid";
  btnGrid.className = "control-panel__btn";
  btnGrid.setAttribute("aria-pressed", "true");
  btnGrid.textContent = "网格";
  btnGrid.addEventListener("click", handlers.onGridToggle);
  rowView.appendChild(btnGrid);

  const btnField = document.createElement("button");
  btnField.type = "button";
  btnField.id = "toggle-field";
  btnField.className = "control-panel__btn";
  btnField.setAttribute("aria-pressed", "true");
  btnField.textContent = "场";
  btnField.addEventListener("click", handlers.onFieldToggle);
  rowView.appendChild(btnField);

  const btnReset = document.createElement("button");
  btnReset.type = "button";
  btnReset.id = "btn-reset";
  btnReset.className = "control-panel__btn control-panel__btn--reset";
  btnReset.textContent = "重置";
  btnReset.addEventListener("click", handlers.onReset);
  rowView.appendChild(btnReset);

  container.appendChild(rowView);

  const rowTools = document.createElement("div");
  rowTools.className = "control-panel__row";

  const btnGuide = document.createElement("button");
  btnGuide.type = "button";
  btnGuide.id = "btn-guide";
  btnGuide.className = "control-panel__btn control-panel__btn--guide";
  btnGuide.textContent = "说明";
  btnGuide.title = "界面说明与场上直播";
  btnGuide.setAttribute("aria-expanded", "false");
  rowTools.appendChild(btnGuide);

  const btnConditions = document.createElement("button");
  btnConditions.type = "button";
  btnConditions.id = "btn-conditions";
  btnConditions.className = "control-panel__btn control-panel__btn--conditions";
  btnConditions.textContent = "条件";
  btnConditions.title = "里程碑条件科技树";
  btnConditions.setAttribute("aria-expanded", "false");
  rowTools.appendChild(btnConditions);

  const btnSnapshot = document.createElement("button");
  btnSnapshot.type = "button";
  btnSnapshot.id = "btn-snapshot";
  btnSnapshot.className = "control-panel__btn control-panel__btn--snapshot";
  btnSnapshot.textContent = "快照";
  btnSnapshot.title = "截取此刻情况说明";
  btnSnapshot.addEventListener("click", handlers.onSnapshot);
  rowTools.appendChild(btnSnapshot);

  container.appendChild(rowTools);

  /**
   * @param {{ paused: boolean, timeScale: number, showGrid: boolean, showField: boolean }} state
   */
  function syncUi(state) {
    btnPause.textContent = state.paused ? "▶" : "⏸";
    btnPause.setAttribute("aria-pressed", String(state.paused));
    btnPause.title = state.paused ? "继续" : "暂停";

    for (const scale of TIME_SCALES) {
      speedButtons[scale].classList.toggle(
        "control-panel__btn--active",
        state.timeScale === scale,
      );
      speedButtons[scale].setAttribute("aria-pressed", String(state.timeScale === scale));
    }

    btnGrid.setAttribute("aria-pressed", String(state.showGrid));
    btnField.setAttribute("aria-pressed", String(state.showField));
  }

  syncUi({
    paused: false,
    timeScale: handlers.getTimeScale(),
    showGrid: true,
    showField: true,
  });

  return { syncUi, btnPause, btnGrid, btnField, btnGuide, btnConditions };
}
