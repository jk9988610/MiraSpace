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
 *   onPrint: () => void,
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

  const rowPrint = document.createElement("div");
  rowPrint.className = "control-panel__row";

  const btnPrint = document.createElement("button");
  btnPrint.type = "button";
  btnPrint.id = "btn-print";
  btnPrint.className = "control-panel__btn control-panel__btn--print";
  btnPrint.textContent = "打印记录";
  btnPrint.title = "打印全部阶段指标数据记录";
  btnPrint.addEventListener("click", handlers.onPrint);
  rowPrint.appendChild(btnPrint);

  container.appendChild(rowPrint);

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

  return { syncUi, btnPause, btnGrid, btnField };
}
