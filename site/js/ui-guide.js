/**
 * UI guide panel: fixed overview + live feed (last 10). Non-blocking; game continues.
 */

const STATIC_GUIDE_HTML = `
<section class="ui-guide__section">
  <h3 class="ui-guide__heading">界面总览</h3>
  <div class="ui-guide__diagram">
    <svg viewBox="0 0 320 180" class="ui-guide__svg" aria-hidden="true">
      <rect x="4" y="4" width="312" height="22" rx="4" fill="rgba(80,140,200,0.25)" stroke="rgba(120,180,240,0.5)"/>
      <text x="160" y="19" text-anchor="middle" fill="#c8dff8" font-size="10">顶栏 · 科学阶段 Tab</text>
      <rect x="4" y="32" width="88" height="120" rx="4" fill="rgba(60,100,140,0.2)" stroke="rgba(120,160,200,0.4)"/>
      <text x="48" y="50" text-anchor="middle" fill="#9fb8d0" font-size="9">HUD</text>
      <text x="48" y="64" text-anchor="middle" fill="#7a94ac" font-size="7">指标+sparkline</text>
      <line x1="48" y1="72" x2="48" y2="90" stroke="#7fd4a8" stroke-dasharray="3 2"/>
      <text x="48" y="100" text-anchor="middle" fill="#7a94ac" font-size="7">虚线=门槛</text>
      <rect x="98" y="32" width="150" height="120" rx="4" fill="rgba(20,40,60,0.35)" stroke="rgba(80,120,160,0.35)"/>
      <circle cx="148" cy="72" r="6" fill="#8ec8ff" opacity="0.8"/>
      <circle cx="168" cy="82" r="4" fill="#e8b44d"/>
      <circle cx="188" cy="68" r="5" fill="#7fd4a8"/>
      <text x="173" y="110" text-anchor="middle" fill="#9fb8d0" font-size="9">Canvas 模拟场</text>
      <rect x="254" y="32" width="62" height="28" rx="4" fill="rgba(100,160,220,0.2)" stroke="rgba(120,180,240,0.45)"/>
      <text x="285" y="50" text-anchor="middle" fill="#c8dff8" font-size="8">里程碑</text>
      <rect x="254" y="124" width="62" height="28" rx="4" fill="rgba(50,90,130,0.35)" stroke="rgba(120,160,200,0.4)"/>
      <text x="285" y="142" text-anchor="middle" fill="#9fb8d0" font-size="8">控制区</text>
    </svg>
  </div>
  <ul class="ui-guide__list" id="ui-guide-static-list">
    <li><strong>左上 HUD</strong>：当前阶段涌现指标；滑动查看全部。</li>
    <li><strong>顶栏 Tab</strong>：切换 preset，保留 seed，重置世界。</li>
    <li><strong>右下控制</strong>：暂停、1×/5×/20×、网格、场、重置、打印记录。</li>
    <li><strong>Canvas</strong>：单指平移观察；场热力图可开关。</li>
  </ul>
</section>
`;

/**
 * @param {HTMLElement} panelContainer
 * @param {HTMLElement} toggleBtn
 * @param {{ getContext: () => object | null }} opts
 */
export function createUiGuide(panelContainer, toggleBtn, opts) {
  panelContainer.className = "ui-guide-panel";
  panelContainer.hidden = true;
  panelContainer.setAttribute("role", "dialog");
  panelContainer.setAttribute("aria-label", "界面说明");

  panelContainer.innerHTML = `
    <header class="ui-guide-panel__header">
      <span class="ui-guide-panel__title">说明</span>
      <button type="button" class="ui-guide-panel__close" aria-label="关闭说明">×</button>
    </header>
    <div class="ui-guide-panel__body">
      <div class="ui-guide-panel__static" id="ui-guide-static">${STATIC_GUIDE_HTML}</div>
      <section class="ui-guide__section ui-guide__section--live">
        <h3 class="ui-guide__heading">场上直播（最近 10 条）</h3>
        <ul class="ui-guide__live" id="ui-guide-live"></ul>
      </section>
    </div>
  `;

  const liveList = panelContainer.querySelector("#ui-guide-live");
  const staticList = panelContainer.querySelector("#ui-guide-static-list");
  const btnClose = panelContainer.querySelector(".ui-guide-panel__close");
  /** @type {string[]} */
  const feed = [];
  let open = false;

  /** @param {string} message */
  function pushLive(message) {
    const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    feed.unshift(`[${stamp}] ${message}`);
    if (feed.length > 10) feed.length = 10;
    if (liveList) {
      liveList.innerHTML = feed.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    }
  }

  function updateStatic() {
    const ctx = opts.getContext();
    if (!ctx || !staticList) return;

    const status = ctx.paused ? "已暂停" : `运行中 · ${ctx.timeScale}×`;
    staticList.innerHTML = `
      <li><strong>当前阶段</strong>：${escapeHtml(ctx.stageLabel)}（${escapeHtml(ctx.presetName)}）</li>
      <li><strong>运行</strong>：${status} · seed ${ctx.seed} · ${ctx.simTime.toFixed(1)} s · tick ${ctx.tickCount}</li>
      <li><strong>左上 HUD</strong>：${escapeHtml(ctx.hudStage)} 指标组；sparkline 虚线=门槛。</li>
      <li><strong>顶栏 Tab</strong>：切换 preset 会重置世界，保留 seed 与倍率。</li>
      <li><strong>右下控制</strong>：暂停/倍率/网格/场/重置/打印；不暂停模拟。</li>
      <li><strong>Canvas</strong>：粒子${ctx.particleCount}${ctx.strandCount != null ? ` · strand ${ctx.strandCount}` : ""}${ctx.vesicleCount != null ? ` · vesicle ${ctx.vesicleCount}` : ""}。</li>
    `;
  }

  function setOpen(next) {
    open = next;
    panelContainer.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
    if (open) updateStatic();
  }

  toggleBtn.addEventListener("click", () => {
    setOpen(!open);
    pushLive(open ? "打开说明面板" : "关闭说明面板");
  });

  btnClose?.addEventListener("click", () => {
    setOpen(false);
    pushLive("关闭说明面板");
  });

  pushLive("说明系统就绪");

  return {
    pushLive,
    updateStatic,
    isOpen: () => open,
  };
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Track sim field changes and emit live guide messages (throttled).
 */
export function createSimObserver(onEvent) {
  /** @type {Record<string, number | string | boolean>} */
  let last = {};

  /**
   * @param {import('./world.js').World} world
   * @param {number} tick
   */
  function observe(world, tick) {
    if (tick % 20 !== 0) return;

    const snap = {
      particles: world.particles.count(),
      strands: world.replicator?.count() ?? 0,
      vesicles: world.vesicle?.count() ?? 0,
      colonies: world.colony?.count() ?? 0,
      fission: world.metrics.fissionEvents ?? 0,
    };

    if (last.particles != null && snap.particles !== last.particles) {
      onEvent(`粒子数变化：${last.particles} → ${snap.particles}`);
    }
    if (world.replicator && last.strands != null && snap.strands !== last.strands) {
      onEvent(`复制子 strand：${last.strands} → ${snap.strands}`);
    }
    if (world.vesicle && last.vesicles != null && snap.vesicles !== last.vesicles) {
      onEvent(`膜泡 vesicle：${last.vesicles} → ${snap.vesicles}`);
    }
    if (world.colony && last.colonies != null && snap.colonies !== last.colonies) {
      onEvent(`群体 colony：${last.colonies} → ${snap.colonies}`);
    }
    if (last.fission != null && snap.fission > last.fission) {
      onEvent(`分裂事件累计：${snap.fission}`);
    }

    last = snap;
  }

  function reset() {
    last = {};
  }

  return { observe, reset };
}
