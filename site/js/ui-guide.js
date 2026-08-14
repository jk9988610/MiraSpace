/**
 * UI guide panel: fixed overview + live feed (last 10). Non-blocking; game continues.
 */

const PARTICLE_LEGEND_HTML = `
<section class="ui-guide__section ui-guide__section--legend">
  <h3 class="ui-guide__heading">画布粒子与颜色</h3>
  <p class="ui-guide__lead">圆点<strong>越大</strong>通常表示粒子类型越大；放大观察时尺寸差异更明显。</p>
  <ul class="ui-guide__legend">
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--monomer" aria-hidden="true"></span>
      <span><strong>浅蓝小点 · monomer 单体</strong>（约 3px）— 游离原料，移动最快，被催化剂附近可耦合成二聚体。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--catalyst" aria-hidden="true"></span>
      <span><strong>金黄稍大 · catalyst 催化剂</strong>（约 4px）— 移动慢，周围催化单体配对；S2+ 附近可成核 strand。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--dimer" aria-hidden="true"></span>
      <span><strong>深蓝最大 · dimer 二聚体</strong>（约 5px）— 两单体结合产物，易局部富集，驱动 S1 clusterIndex。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--strand" aria-hidden="true"></span>
      <span><strong>紫边彩芯 · strand 复制子</strong>（S2+，约 4px）— 外液裸 strand；<strong>色相按谱系 lineage</strong>区分，紫描边为遗传链。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--vesicle" aria-hidden="true"></span>
      <span><strong>浅蓝空心圆 · vesicle 膜泡</strong>（S3+）— 圆越大膜泡越大；内点小圆为<strong>膜内 strand</strong>。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--chemoton" aria-hidden="true"></span>
      <span><strong>亮蓝填充膜泡 · chemoton</strong>（S4+）— 填充越亮表示<strong>代谢 flux</strong>越高；需代谢/膜/遗传三子协调才可分裂。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--link" aria-hidden="true"></span>
      <span><strong>淡绿连线 · colony 黏附</strong>（S5）— 分裂后膜泡间的弹性链接，越亮链接越强。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--drive" aria-hidden="true"></span>
      <span><strong>亮蓝热力·驱动</strong>（默认）— 能量<strong>梯度</strong>强度，单体沿此被拉向高能量区。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--field" aria-hidden="true"></span>
      <span><strong>青绿热力·能量</strong> — 场上能量浓度（非梯度）。</span>
    </li>
    <li class="ui-guide__legend-item">
      <span class="ui-guide__swatch ui-guide__swatch--waste" aria-hidden="true"></span>
      <span><strong>紫红热力·废物</strong> — 代谢废物堆积，全体粒子阻力增大、变慢。</span>
    </li>
  </ul>
</section>
`;

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
      <circle cx="148" cy="72" r="3" fill="#7ec8e8"/>
      <circle cx="168" cy="82" r="4" fill="#e8b44d"/>
      <circle cx="188" cy="68" r="5" fill="#3d7ab8"/>
      <text x="173" y="110" text-anchor="middle" fill="#9fb8d0" font-size="9">Canvas 模拟场</text>
      <rect x="254" y="32" width="62" height="28" rx="4" fill="rgba(100,160,220,0.2)" stroke="rgba(120,180,240,0.45)"/>
      <text x="285" y="50" text-anchor="middle" fill="#c8dff8" font-size="8">弹幕</text>
      <rect x="254" y="124" width="62" height="28" rx="4" fill="rgba(50,90,130,0.35)" stroke="rgba(120,160,200,0.4)"/>
      <text x="285" y="142" text-anchor="middle" fill="#9fb8d0" font-size="8">控制区</text>
    </svg>
  </div>
  <ul class="ui-guide__list" id="ui-guide-static-list">
    <li><strong>左上 HUD</strong>：当前阶段涌现指标；sparkline 虚线 = 里程碑门槛。</li>
    <li><strong>顶栏 Tab</strong>：切换 preset，保留 seed，重置世界。</li>
    <li><strong>右下控制</strong>：暂停、倍率、网格、场、重置、说明、条件、快照。</li>
    <li><strong>里程碑弹幕</strong>：达成门槛时自左向右飞过画布，不打断操作。</li>
    <li><strong>Canvas</strong>：单指平移可绕世界一圈（周期边界，无固定原点）；热力按钮循环 驱动/能量/废物/关。</li>
  </ul>
</section>
${PARTICLE_LEGEND_HTML}
`;

/** @type {Record<string, string[]>} */
const STAGE_LIVE_HINTS = {
  s1: [
    "S1：关注单体→催化剂→二聚体链路，二聚体局部富集推高 clusterIndex。",
    "开启「场」可看到能量热点，催化剂常出现在高能量区。",
  ],
  s2: [
    "S2：催化剂附近可出现紫边 strand（复制子），色相代表不同谱系。",
    "strand 会吞食附近单体并模板复制，序列长度影响 informationAccumulation。",
  ],
  s3: [
    "S3：浅蓝膜泡可吞入外液 strand；膜内小点=已成功封装。",
    "膜泡变大后可分裂；HUD fissionEvents 为 300s 窗内分裂次数。",
  ],
  s4: [
    "S4：膜泡填充亮度 = 代谢 flux；需代谢/膜/遗传协调才达 chemotonCoherence。",
    "只有内含 strand 的协调膜泡更容易通过 fitness 门控分裂。",
  ],
  s5: [
    "S5：分裂后淡绿连线 = colony 黏附；多成员可出现 feeder / replicator 分工。",
    "观察膜泡簇是否比单泡存活更久（multicellularPersistence）。",
  ],
};

/** @param {string} stageKey */
export function particleLegendBroadcastLines(stageKey) {
  const base = [
    "图例：浅蓝小点=单体 monomer（最小最快）",
    "图例：金黄=catalyst 催化剂（稍大、较慢）",
    "图例：深蓝=dimer 二聚体（最大基质粒子）",
    "图例：亮蓝热力=能量梯度驱动单体移动",
    "图例：青绿热力=能量浓度 · 紫红=废物阻力",
  ];
  const lines = [...base];
  if (stageKey !== "s1") {
    lines.push("图例：紫边彩芯=strand 复制子（色相=谱系 lineage）");
  }
  if (stageKey === "s3" || stageKey === "s4" || stageKey === "s5") {
    lines.push("图例：浅蓝圆环=vesicle 膜泡（越大膜泡越大；内点=膜内 strand）");
  }
  if (stageKey === "s4" || stageKey === "s5") {
    lines.push("图例：亮蓝填充膜泡=chemoton 代谢越强越亮");
  }
  if (stageKey === "s5") {
    lines.push("图例：淡绿连线=colony 分裂后黏附链接");
  }
  const hints = STAGE_LIVE_HINTS[stageKey];
  if (hints) lines.push(...hints);
  return lines;
}

/**
 * @param {HTMLElement} panelContainer
 * @param {HTMLElement} toggleBtn
 * @param {{
 *   getContext: () => object | null,
 *   getStageKey?: () => string | null,
 * }} opts
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
        <h3 class="ui-guide__heading">场上直播（最近 12 条）</h3>
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
    if (feed.length > 12) feed.length = 12;
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
      <li><strong>左上 HUD</strong>：${escapeHtml(ctx.hudStage)} 指标组；sparkline 虚线 = 里程碑门槛。</li>
      <li><strong>里程碑弹幕</strong>：达成时自左向右飞过画布；可在「条件」面板查看科技树进度。</li>
      <li><strong>画布</strong>：粒子 ${ctx.particleCount}${ctx.strandCount != null ? ` · strand ${ctx.strandCount}` : ""}${ctx.vesicleCount != null ? ` · vesicle ${ctx.vesicleCount}` : ""}${ctx.colonyCount != null ? ` · colony ${ctx.colonyCount}` : ""}。</li>
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
    broadcastStageLegend: () => {
      const key = opts.getStageKey?.() ?? "s1";
      pushLive(`—— ${key.toUpperCase()} 画布图例 ——`);
      for (const line of particleLegendBroadcastLines(key)) {
        pushLive(line);
      }
    },
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
      coherence: world.metrics.chemotonCoherence ?? 0,
    };

    if (last.particles != null && snap.particles !== last.particles) {
      const delta = snap.particles - last.particles;
      const hint = delta > 0
        ? "（多为单体催化生成二聚体或复制消耗）"
        : "（代谢、复制或离屏裁剪）";
      onEvent(`粒子数 ${last.particles} → ${snap.particles}${hint}`);
    }
    if (world.replicator && last.strands != null && snap.strands !== last.strands) {
      onEvent(`复制子 strand ${last.strands} → ${snap.strands}（外液紫边点；膜内见膜泡内小点）`);
    }
    if (world.vesicle && last.vesicles != null && snap.vesicles !== last.vesicles) {
      const d = snap.vesicles - last.vesicles;
      const why = d > 0 ? "成核或分裂产生" : "分裂合并或溶解";
      onEvent(`膜泡 vesicle ${last.vesicles} → ${snap.vesicles}（${why}）`);
    }
    if (world.colony && last.colonies != null && snap.colonies !== last.colonies) {
      onEvent(`群体 colony ${last.colonies} → ${snap.colonies}（分裂建链后出现/解散）`);
    }
    if (last.fission != null && snap.fission > last.fission) {
      onEvent(`分裂累计 ${snap.fission} 次 / 300s 窗（膜泡一分为二）`);
    }
    if (world.chemoton && last.coherence != null && snap.coherence > 0.05 && last.coherence <= 0.05) {
      onEvent("化学子协调出现：部分膜泡三子系统同时在线（亮蓝膜泡）");
    }

    last = snap;
  }

  function reset() {
    last = {};
  }

  return { observe, reset };
}
