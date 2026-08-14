# MiraSpace

米拉空间（MiraSpace）——数字生命演化 Canvas 模拟。当前里程碑：**S5 多细胞性（colony）**。

**生物学命名与粒子表达**：界面与文档优先使用生物学类比称谓（酶、核酸样聚合物、原细胞膜泡等）；代码内部仍用 `monomer`、`strand` 等稳定 id。详见 [`docs/BIOLOGY_NOMENCLATURE.md`](docs/BIOLOGY_NOMENCLATURE.md) 与 `site/js/biology-names.js`。

**米拉地球（规划中）**：基因表达驱动营养级与气体循环的设计见 [`docs/EARTH_GENE_EXPRESSION.md`](docs/EARTH_GENE_EXPRESSION.md)；分阶段实现进度见 [`docs/EARTH_ECOSPHERE_ROADMAP.md`](docs/EARTH_ECOSPHERE_ROADMAP.md)。

## 在线访问

https://jk9988610.github.io/MiraSpace/

打开后**先选科学阶段**（初始化弹窗），不会自动写入 `?preset=`；顶栏可随时切换。深链接示例：

- S1 前生物化学：`?seed=42&preset=stage0-default`
- S5 多细胞生物：`?seed=42&preset=stage5-default`

## 本地运行

```bash
cd site
python3 -m http.server 8080
# S1: http://localhost:8080/?seed=42
# S2: http://localhost:8080/?seed=42&preset=stage2-default
# S4: http://localhost:8080/?seed=42&preset=stage4-default
# S5: http://localhost:8080/?seed=42&preset=stage5-default
```

## 功能

| 阶段 | 生物学称谓 | 内容 |
|------|------------|------|
| **P0** | — | Canvas、横屏、坐标系、单指平移、固定 tick、周期边界 |
| **S1** | 前生物化学 | energy/waste 场、代谢单体/酶/二聚体、三项 S1 指标 |
| **P2** | — | `?seed=` 复现、60 s sparkline、场/粒子性能裁剪 |
| **S2** | 遗传复制 | 核酸样聚合物（成核/模板复制/突变）、四项 S2 指标 HUD |
| **S3** | 原细胞 | 原细胞膜泡（成核/吞入/生长/分裂）、四项 S3 指标；裸聚合物仍复制 |
| **S4** | 整合细胞 | chemoton 三子耦合（代谢/遗传/膜）、fitness 门控分裂、四项 S4 指标 |
| **S5** | 多细胞生物 | colony 分裂建链、role 涌现、flux 交换、四项 S5 指标；v1 路线图闭合 |
| **Nav** | — | 单页 5 Tab（前生物化学→多细胞生物），切换 reset 世界、HUD 指标组显隐 |
| **Clock** | — | `sim-clock.js` tick/render 解耦；浏览器 1×/5×/20×；headless 固定 ×1 |

画布粒子为**简单圆点/圆环**（非分子动画）；S1 默认半径约 monomer 5px、酶 7px、二聚体 8px。

## S1 指标

- 簇集指数 `clusterIndex` · 自催化得分 `autocatalyticScore` · 负熵通量 `negentropyFlux`

## S2 指标

- 遗传度 `heritability` — 亲–子序列相似度（1 − d/L）
- 选择扫荡 `selectiveSweep` — Top 谱系占比 + 适应度分化
- 信息累积 `informationAccumulation` — 平均序列长度 / L₀
- 寄生序列占比 `parasiteFraction` — 短序列寄生占比（仅观测）

门槛见 `site/data/presets/stage2-default.json` 中 `metricsThresholdsS2`。

## S3 指标

- 封装增益 `encapsulationGain` — 膜内聚合物密度 / 外液密度
- 胞外寄生负载 `parasiteLoad` — 外液裸聚合物数 / 总数
- 细胞分裂事件 `fissionEvents` — 300 sim s 滚动窗内分裂次数
- 原细胞数 `vesicleCount` — 当前膜泡数（仅观测）

门槛见 `site/data/presets/stage3-default.json` 中 `metricsThresholdsS3`。

## S4 指标

- 细胞协调度 `chemotonCoherence` — 三子同时高于阈的 vesicle 占比
- 谱系延续 `lineagePersistence` — 膜谱系平均存活代数
- 基因组保真 `storageFidelity` — redundant 存储模式保真（观测）
- 协调细胞数 `chemotonCount` — 满足 coherence 的 vesicle 数（观测）

门槛见 `site/data/presets/stage4-default.json` 中 `metricsThresholdsS4`。

## S5 指标

- 多细胞持续性 `multicellularPersistence` — colony 平均寿命 / 单 cell chemoton 平均寿命
- 细胞分工 `divisionOfLabor` — 含 ≥2 种 role 的 colony 占比
- 发育模式 `developmentalPattern` — colony 链接空间自相关 vs 随机
- 群体数 `colonyCount` — 当前 colony 数（仅观测）

门槛见 `site/data/presets/stage5-default.json` 中 `metricsThresholdsS5`。

> S3 结案门 sustained 达标：维护者跑 `--acceptance`，README 标「S3 结案待定」。

### S3 vs S4 对照

| 机制 | S3 | S4 |
|------|----|----|
| vesicle 分裂 | 半径 + 能量 | + **chemotonFitness** + coherenceTicks |
| 膜内复制 | S2 机制 | × metabolicFlux × membraneHealth |
| 存储升级 | — | 涌现 `storageMode: redundant` |
| 裸 strand | ✓ 共存 | ✓ 共存 |

### 示例运行（stage2-default，seed=42，600 sim s）

| 指标 | 当前 | 滑动平均 |
|------|------|----------|
| 遗传度 | ~0.85+ | ~0.80+ |
| 选择扫荡 | ~0.1+ | ~0.15+ |
| 信息累积 | ~1.0+ | ~1.0+ |
| 寄生序列占比 | 观测 | — |

> 精确值随 seed 与模拟时长变化；以 headless 脚本输出为准。

### 错误阈值对照（headless）

| preset | mutationRate | 600 sim s 表现 |
|--------|--------------|----------------|
| `stage2-default` | 0.002 | 信息长度可维持/增长 |
| `stage2-error-threshold` | 0.05 | 信息积累受错误阈值压制 |

## 测试

按 [Talk 测试分层规范](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-测试分层与报告规范.md)：

| 层级 | 命令 | 谁跑 |
|------|------|------|
| **Smoke**（AI 默认） | `node scripts/run-suite.mjs --smoke` | 每次改代码后 |
| **Acceptance** | `node scripts/run-suite.mjs --acceptance` | CI nightly / 维护者 |
| Quick | `node scripts/s*-headless-test.mjs` | 60 sim s 快速档 |

```bash
# AI / 日常：≤5 s 墙钟，输出可复制 Markdown 报告
node scripts/run-suite.mjs --smoke

# 科学结案：600 sim s × seeds 42/7/99（勿在 AI 对话中默认跑）
node scripts/run-suite.mjs --acceptance
node scripts/run-suite.mjs --acceptance --preset=stage3-default
```

PR 模板：`Smoke: exit 0（wallMs: …）` · `Acceptance: 未在 PR 中运行`

### 旧入口（仍可用）

```bash
node scripts/s1-headless-test.mjs --acceptance
node scripts/s2-headless-test.mjs --acceptance
node scripts/s3-headless-test.mjs --acceptance
```

## URL 参数

- `?seed=42` — 复现随机初始化
- `?preset=stage2-default` — 加载 S2 preset（支持 `extends` 合并）
- `?preset=stage3-default` — 加载 S3 preset（extends stage2）
- `?preset=stage4-default` — 加载 S4 preset（extends stage3，chemoton 耦合）
- `?preset=stage5-default` — 加载 S5 preset（extends stage4，colony 链接）
- 顶栏 Tab 切换阶段；深链接 `?seed=42&preset=stage3-default&timeScale=5` 仍可用

## 约束

- Vanilla JS + Canvas 2D，零构建
- **简单粒子表达**：圆点/圆环/连线，不做分子动画
- **生物学类比命名**：UI/文档用生物学称谓；代码 id 保持 `monomer`/`strand` 等（见 `biology-names.js`）
- **禁止** dimer 升级 strand、脚本 spawn 复制子/vesicle/**colony**
- **禁止** 按 RNA→DNA→细胞 线性排期；**禁止** 关闭裸 strand 复制

## 目录结构

```
docs/
├── BIOLOGY_NOMENCLATURE.md   # 粒子↔生物学映射与路线图
├── EARTH_GENE_EXPRESSION.md  # 基因表达与营养级规格（已确认）
├── EARTH_ECOSPHERE_ROADMAP.md # 米拉地球分阶段进度
site/
├── js/
│   ├── biology-names.js      # 中英文生物学显示名
│   ├── replicator.js         # S2 strand
│   ├── vesicle.js            # S3 膜 compartment
│   ├── chemoton.js           # S4 三子耦合
│   ├── colony.js             # S5 colony 链接与分工
│   ├── stage-nav.js          # 单页阶段导航 Tab
│   ├── sim-clock.js          # 时间倍率与 tick/render 解耦
│   ├── control-panel.js      # 右下角运行控制
│   ├── preset.js
│   └── ...
└── data/presets/
    ├── stage0-default.json
    ├── stage2-default.json
    ├── stage2-error-threshold.json
    └── stage3-default.json
    └── stage4-default.json
    └── stage5-default.json
scripts/
├── run-suite.mjs
├── smoke-test.mjs
├── s5-headless-test.mjs
├── s4-headless-test.mjs
├── test-report.mjs           # Markdown 报告
├── test-utils.mjs
├── s1-headless-test.mjs
├── s2-headless-test.mjs
├── s3-headless-test.mjs
└── preset-loader.mjs
```

## 文档（Talk）

- [测试分层与报告规范](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-测试分层与报告规范.md)
- [性能与时间控制 UI](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-性能与时间控制UI.md)
- [阶段导航 UI](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-阶段导航UI.md)
- [v1 闭合登记](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-v1-闭合登记.md)
- [S5 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-S5-多细胞性.md)
- [S4 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-S4-整合细胞单元.md)
- [S3 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-S3-个体化与原细胞.md)
- [S2 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-S2-达尔文阈值.md)
- [科学阶段路线图](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-科学阶段路线图.md)
- [AI-GUIDE](https://github.com/jk9988610/Talk/blob/main/docs/AI-GUIDE.md)
