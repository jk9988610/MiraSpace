# MiraSpace

米拉空间（MiraSpace）——数字生命演化 Canvas 模拟。当前里程碑：**P0 观察基底** + **S1 前生物底物**（阶段 0）。

## 在线访问

部署后可通过 GitHub Pages 访问：`https://jk9988610.github.io/MiraSpace/`

## 本地运行

无需构建链，静态文件即可：

```bash
cd site
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 功能（阶段 0）

| 模块 | 内容 |
|------|------|
| **P0** | 全屏 Canvas、横屏优先、世界坐标（Y 向上）、单指平移、固定 30 Hz tick、周期边界、暂停 |
| **S1** | `energy` / `waste` 扩散场、monomer / catalyst / dimer 粒子、三项涌现指标 HUD |

## S1 指标

- `clusterIndex` — dimer 空间聚簇（局部密度 / 全局密度）
- `autocatalyticScore` — 催化剂附近 dimer 生成率 / 全局平均
- `negentropyFlux` — 类型分布 unevenness 相对初始基线

门槛常量见 `site/data/presets/stage0-default.json` 中的 `metricsThresholds`。

## URL 参数

- `?seed=42` — 复现随机初始化（默认 42）

## 文档

规格来源（Talk 仓库）：

- [AI-GUIDE](https://github.com/jk9988610/Talk/blob/main/docs/AI-GUIDE.md)
- [科学阶段路线图](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-科学阶段路线图.md)
- [阶段 0 规格](https://github.com/jk9988610/Talk/blob/main/docs/07-projects/2026-08-14-MiraSpace-阶段0-空域坐标与观察者.md)

## 约束

- Vanilla JS + Canvas 2D，零构建
- **不**实现可遗传复制子、膜个体、RNA/DNA 命名实体
- **不**按 RNA→DNA→细胞 线性排期
- **不**脚本伪造涌现

## 目录结构

```
site/
├── index.html
├── styles.css
├── js/
│   ├── main.js
│   ├── camera.js
│   ├── world.js
│   ├── fields.js
│   ├── particles.js
│   └── metrics.js
└── data/presets/
    └── stage0-default.json
```
