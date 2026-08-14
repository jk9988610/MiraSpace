# MiraSpace

米拉空间（MiraSpace）——数字生命演化 Canvas 模拟。当前里程碑：**P0 + S1 + P2**（阶段 0）、**S2 达尔文阈值**（复制子）、**S3 个体化与原细胞**（vesicle）。

## 在线访问

https://jk9988610.github.io/MiraSpace/

- S1 默认：`?seed=42`
- S2 复制子：`?seed=42&preset=stage2-default`
- S3 原细胞：`?seed=42&preset=stage3-default`

## 本地运行

```bash
cd site
python3 -m http.server 8080
# S1: http://localhost:8080/?seed=42
# S2: http://localhost:8080/?seed=42&preset=stage2-default
# S3: http://localhost:8080/?seed=42&preset=stage3-default
```

## 功能

| 阶段 | 内容 |
|------|------|
| **P0** | Canvas、横屏、坐标系、单指平移、固定 tick、周期边界 |
| **S1** | energy/waste 场、monomer/catalyst/dimer、三项 S1 指标 |
| **P2** | `?seed=` 复现、60 s sparkline、场/粒子性能裁剪 |
| **S2** | strand 复制子（成核/模板复制/突变）、四项 S2 指标 HUD |
| **S3** | vesicle 膜（成核/吞入/生长/分裂）、四项 S3 指标 HUD；裸 strand 仍复制 |

## S1 指标

- `clusterIndex` · `autocatalyticScore` · `negentropyFlux`

## S2 指标

- `heritability` — 亲–子序列相似度（1 − d/L）
- `selectiveSweep` — Top 谱系占比 + 适应度分化
- `informationAccumulation` — 平均序列长度 / L₀
- `parasiteFraction` — 短序列寄生占比（仅观测）

门槛见 `site/data/presets/stage2-default.json` 中 `metricsThresholdsS2`。

## S3 指标

- `encapsulationGain` — 膜内 strand 密度 / 外液 strand 密度
- `parasiteLoad` — 外液裸 strand 数 / 总 strand 数
- `fissionEvents` — 300 sim s 滚动窗内分裂次数
- `vesicleCount` — 当前 vesicle 数（仅观测）

门槛见 `site/data/presets/stage3-default.json` 中 `metricsThresholdsS3`。

### S2 vs S3 对照

| 机制 | S2 | S3 |
|------|----|----|
| 裸 strand 复制 | ✓ | ✓（共存，不关闭） |
| vesicle 膜 | — | 成核 / 吞入 / 生长 / 分裂 |
| 脚本 spawn 细胞 | 禁止 | 禁止 |
| 主要涌现指标 | 遗传/选择/信息 | 包被增益 / 寄生负载 / 分裂 |

### 示例运行（stage2-default，seed=42，600 sim s）

| 指标 | 当前 | 滑动平均 |
|------|------|----------|
| heritability | ~0.85+ | ~0.80+ |
| selectiveSweep | ~0.1+ | ~0.15+ |
| informationAccumulation | ~1.0+ | ~1.0+ |
| parasiteFraction | 观测 | — |

> 精确值随 seed 与模拟时长变化；以 headless 脚本输出为准。

### 错误阈值对照（headless）

| preset | mutationRate | 600 sim s 表现 |
|--------|--------------|----------------|
| `stage2-default` | 0.002 | 信息长度可维持/增长 |
| `stage2-error-threshold` | 0.05 | 信息积累受错误阈值压制 |

```bash
node scripts/s2-headless-test.mjs
node scripts/s3-headless-test.mjs   # stage3，须 exit 0
```

## 测试

```bash
node scripts/s1-headless-test.mjs   # stage0，须 exit 0
node scripts/s2-headless-test.mjs   # stage2 + 错误阈值对照
```

## URL 参数

- `?seed=42` — 复现随机初始化
- `?preset=stage2-default` — 加载 S2 preset（支持 `extends` 合并）
- `?preset=stage3-default` — 加载 S3 preset（extends stage2）

## 约束

- Vanilla JS + Canvas 2D，零构建
- **禁止** dimer 升级 strand、脚本 spawn 复制子/vesicle、RNA/DNA 命名
- **禁止** 按 RNA→DNA→细胞 线性排期；**禁止** 关闭裸 strand 复制

## 目录结构

```
site/
├── js/
│   ├── replicator.js      # S2 strand
│   ├── vesicle.js         # S3 膜 compartment
│   ├── preset.js
│   └── ...
└── data/presets/
    ├── stage0-default.json
    ├── stage2-default.json
    ├── stage2-error-threshold.json
    └── stage3-default.json
scripts/
├── s1-headless-test.mjs
├── s2-headless-test.mjs
├── s3-headless-test.mjs
└── preset-loader.mjs
```

## 文档（Talk）

- [S3 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-S3-个体化与原细胞.md)
- [S2 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-S2-达尔文阈值.md)
- [科学阶段路线图](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-科学阶段路线图.md)
- [AI-GUIDE](https://github.com/jk9988610/Talk/blob/main/docs/AI-GUIDE.md)
