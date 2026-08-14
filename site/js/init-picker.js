import { STAGE_TABS } from "./stage-nav.js";

/**
 * First-visit stage picker. Shown when URL has no ?preset= (no auto stage load / URL sync).
 * @param {HTMLElement} container
 * @param {{ onSelect: (tab: import('./stage-nav.js').STAGE_TABS[number]) => void }} handlers
 */
export function createInitPicker(container, handlers) {
  container.className = "init-picker";
  container.hidden = true;
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "false");
  container.setAttribute("aria-label", "选择科学阶段");

  container.innerHTML = `
    <div class="init-picker__dialog">
      <header class="init-picker__header">
        <h2 class="init-picker__title">MiraSpace · 米拉空间</h2>
        <p class="init-picker__lead">请选择要观察的科学阶段。选择后开始模拟；顶栏可随时切换阶段。</p>
      </header>
      <div class="init-picker__grid" role="list"></div>
      <p class="init-picker__hint">深链接仍可用：<code>?preset=stage3-default&amp;seed=42</code></p>
    </div>
  `;

  const grid = container.querySelector(".init-picker__grid");

  for (const tab of STAGE_TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "init-picker__choice";
    btn.setAttribute("role", "listitem");
    btn.innerHTML = `
      <span class="init-picker__choice-label">${tab.label}</span>
      <span class="init-picker__choice-sub">${tab.subtitle}</span>
    `;
    btn.addEventListener("click", () => {
      handlers.onSelect(tab);
    });
    grid?.appendChild(btn);
  }

  function show() {
    container.hidden = false;
  }

  function hide() {
    container.hidden = true;
  }

  return { show, hide, isVisible: () => !container.hidden };
}
