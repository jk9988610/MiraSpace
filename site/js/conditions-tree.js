import {
  MILESTONE_CONDITIONS,
  STAGE_TREE_META,
  evaluateCondition,
} from "./milestone-conditions.js";

const STAGE_ORDER = ["s1", "s2", "s3", "s4", "s5"];

/**
 * @param {HTMLElement} container
 * @param {HTMLElement} toggleBtn
 * @param {{
 *   getContext: () => {
 *     metrics: object,
 *     preset: object,
 *     achieved: Set<string>,
 *     activeHudStages: string[],
 *     stageLabel: string,
 *   } | null,
 * }} opts
 */
export function createConditionsTree(container, toggleBtn, opts) {
  container.className = "conditions-tree";
  container.hidden = true;
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  container.setAttribute("aria-label", "里程碑条件");

  container.innerHTML = `
    <div class="conditions-tree__backdrop" data-action="close"></div>
    <div class="conditions-tree__dialog">
      <header class="conditions-tree__header">
        <div>
          <h2 class="conditions-tree__title">里程碑 · 科技树</h2>
          <p class="conditions-tree__subtitle" id="conditions-tree-subtitle">各阶段需达成的指标门槛</p>
        </div>
        <button type="button" class="conditions-tree__close" aria-label="关闭">×</button>
      </header>
      <div class="conditions-tree__body">
        <div class="tech-tree" id="tech-tree-root"></div>
      </div>
    </div>
  `;

  const root = container.querySelector("#tech-tree-root");
  const subtitle = container.querySelector("#conditions-tree-subtitle");
  const btnClose = container.querySelector(".conditions-tree__close");
  const backdrop = container.querySelector(".conditions-tree__backdrop");
  let open = false;

  /** @type {Record<string, ConditionDef[]>} */
  const byStage = {};
  for (const def of MILESTONE_CONDITIONS) {
    if (!byStage[def.stageKey]) byStage[def.stageKey] = [];
    byStage[def.stageKey].push(def);
  }

  function setOpen(next) {
    open = next;
    container.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
    toggleBtn.classList.toggle("control-panel__btn--active", open);
    if (open) render();
  }

  function close() {
    setOpen(false);
  }

  /** @param {number} value */
  function fmt(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
  }

  function render() {
    const ctx = opts.getContext();
    if (!root) return;

    if (!ctx) {
      root.innerHTML = `<p class="conditions-tree__empty">请先选择阶段并开始模拟。</p>`;
      return;
    }

    if (subtitle) {
      subtitle.textContent = `当前：${ctx.stageLabel} · 虚线门槛与 HUD sparkline 一致`;
    }

    const columns = STAGE_ORDER.map((stageKey, colIndex) => {
      const defs = byStage[stageKey] ?? [];
      const meta = STAGE_TREE_META[stageKey];
      const stageActive = ctx.activeHudStages.includes(stageKey);
      const nodesHtml = defs.map((def, nodeIndex) => {
        const ev = evaluateCondition(def, ctx.metrics, ctx.preset);
        const achieved = ctx.achieved.has(def.id);
        const locked = !ev.available;
        const met = achieved || ev.met;

        let stateClass = "tech-tree__node--pending";
        if (locked) stateClass = "tech-tree__node--locked";
        else if (achieved) stateClass = "tech-tree__node--achieved";
        else if (met) stateClass = "tech-tree__node--ready";
        else if (!stageActive) stateClass = "tech-tree__node--future";

        const op = def.compare === ">=" ? "≥" : "≤";
        const req = locked ? "未配置门槛" : `${def.windowLabel} ${op} ${fmt(ev.threshold)}`;
        const val = locked
          ? "—"
          : `${fmt(ev.current)} / ${fmt(ev.threshold)}${achieved ? " ✓" : ""}`;
        const pct = locked ? 0 : Math.round(ev.progress * 100);

        return `
          <div class="tech-tree__node ${stateClass}" data-node="${def.id}">
            <div class="tech-tree__node-badge">${def.stage}</div>
            <div class="tech-tree__node-title">${def.label}</div>
            <div class="tech-tree__node-req">${req}</div>
            <div class="tech-tree__progress" aria-hidden="true">
              <div class="tech-tree__progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="tech-tree__node-val">${val}</div>
            ${nodeIndex < defs.length - 1 ? '<div class="tech-tree__link tech-tree__link--down"></div>' : ""}
          </div>
        `;
      }).join("");

      const connector = colIndex < STAGE_ORDER.length - 1
        ? `<div class="tech-tree__connector" aria-hidden="true"><span class="tech-tree__connector-line"></span><span class="tech-tree__connector-arrow">▶</span></div>`
        : "";

      return `
        <div class="tech-tree__column ${stageActive ? "tech-tree__column--active" : ""}" data-stage="${stageKey}">
          <div class="tech-tree__stage">
            <span class="tech-tree__stage-id">${stageKey.toUpperCase()}</span>
            <span class="tech-tree__stage-name">${meta?.label ?? stageKey}</span>
            <span class="tech-tree__stage-sub">${meta?.subtitle ?? ""}</span>
          </div>
          <div class="tech-tree__nodes">${nodesHtml}</div>
        </div>
        ${connector}
      `;
    }).join("");

    root.innerHTML = `<div class="tech-tree__track">${columns}</div>`;
  }

  toggleBtn.addEventListener("click", () => {
    setOpen(!open);
  });

  btnClose?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  return {
    render,
    close,
    isOpen: () => open,
  };
}
