# MiraSpace 地球生态 · 基因表达规格（A）

> **状态**：设计已确认（2026-08-14），待按路线图分阶段实现。  
> **原则**：3 个表达区段、6 种代谢 archetype、2 种气体 + 有机碳守恒；程序用查表与小公式，不模拟真实酶动力学。

---

## 1. 与现有代码的关系

| 现有 | 生态时代扩展 |
|------|----------------|
| `strand.sequence[]`（0/1） | 前 12 bit 固定为表达区段 **M|T|R** |
| `replicator.motifs`（如 `[1,0,1]`） | 保留，影响**复制率**，不直接产气 |
| `chemoton.geneticActivity` | 改为「表达强度」：`geneticActivity × decode(...)` |
| `chemoton.role` | UI 映射为营养级中文；底层用 `archetype` |
| `colony._updateRoles` | 可选保留；与基因表达**并行**或逐步替换 |

**涌现约束不变**：无脚本 spawn；气体与有机碳只能来自场交换与捕食转移。

---

## 2. 序列布局（12 bit 表达头）

在 `stage-earth-default`（或 S8 preset）中建议：

- `L0Min = 12`，`L0Max = 24`（成核最短必须能表达）
- **位序**（`sequence[i]` 仍为 0/1，**索引 0 为链头**）：

```
索引:  0 1 2 3 | 4 5 6 7 | 8 9 10 11 | 12 … L-1
模块:    M(4)  |   T(4)  |   R(4)    | 非编码区（复制/寄生/冗余）
```

解码（纯函数，无状态）：

```text
M = bits(0..3)   // 代谢模块，0–15
T = bits(4..7)   // 营养级模块
R = bits(8..11)  // 调控模块
junk = sequence[12..]  // 仅影响复制 motif、storageEmergence、寄生判定
```

若 `sequence.length < 12`：**无法表达**，细胞代谢退化为「渗漏型」（低通量、产少量 CO₂，不产 O₂）。

---

## 3. 模块语义（查表，不追求 16×16 全组合）

### 3.1 M — 代谢模块（低 3 bit 有效，`M & 7`）

| 值 | 代码 id | 生物学说法 | 需环境 | 禁止条件 |
|----|---------|------------|--------|----------|
| 0 | `oxy_photo` | 氧合光合作用（蓝细菌样） | 光、CO₂ | 无光时通量 ≈ 0 |
| 1 | `chemo_auto` | 化能自养 | energy 场、CO₂ | — |
| 2 | `aero_resp` | 好氧呼吸 | O₂、有机碳 | O₂ ≈ 0 时通量 ≈ 0 |
| 3 | `ferment` | 发酵 / 厌氧代谢 | 有机碳 | — |
| 4 | `aero_decomp` | 好氧分解 | O₂、有机碳、废物 | — |
| 5 | `leaky` | 渗漏（未完整表达） | — | 始终低通量 |
| 6–7 | `off` | 沉默 | — | 通量 0 |

> **深度优先**：不做 16 种 M；高 bit 用于微调（见 §5.2 强度系数）。

### 3.2 T — 营养级模块（低 3 bit 有效）

| 值 | 代码 id | 碳源 | 捕食 |
|----|---------|------|------|
| 0 | `autotroph` | 从 **溶解 CO₂** 固定（M 须为自养型） | 否 |
| 1 | `herbivore` | 从 **溶解有机碳 DOC** 摄取 | 否 |
| 2 | `predator` | 从 **邻格 vesicle biomass** 摄取 | 是 |
| 3 | `decomposer` | 从 **废物 + 颗粒有机碳 POC** | 否 |
| 4 | `mixotroph` | CO₂ + DOC 混合 | 否 |
| 5–7 | `generalist` | DOC 为主，效率 ×0.6 | 否 |

**自养判定**：仅当 `T ∈ {autotroph, mixotroph}` 且 `M ∈ {oxy_photo, chemo_auto}` 时走固碳通路。

### 3.3 R — 调控模块（低 4 bit，位域）

| bit | 含义 | 效果 |
|-----|------|------|
| 0 | 好氧耐受 | O₂ 抑制系数 `1/(1 + k_o2×O₂)` 当 M 为厌氧型时 |
| 1 | 光周期 | 夜间表达 × `nightFactor`（默认 0.15） |
| 2 | 陆地偏好 | 陆地格表达 ×1.2，海洋 ×0.9（植物向） |
| 3 | 群体分化 | 在 colony 内允许 §7 分工 |

未置位 = 默认（全日表达、无陆地偏好、不分化）。

---

## 4. 六种 Archetype（对外展示用）

由 `(M,T)` **查表**得到唯一 archetype；非法组合退化为 `leaky_heterotroph`。

| archetype id | 条件（M,T） | UI 中文 | 宏观角色 |
|--------------|-------------|---------|----------|
| `cyanophyte` | oxy_photo + autotroph | 蓝细菌样固碳菌 | 生产者 |
| `chemo_producer` | chemo_auto + autotroph | 化能生产者 | 生产者 |
| `herbivore` | aero_resp + herbivore | 食草消费者 | 消费者 |
| `predator` | aero_resp + predator | 捕食消费者 | 消费者 |
| `anaerobe_decomposer` | ferment + decomposer | 厌氧分解者 | 分解者 |
| `aerobe_decomposer` | aero_decomp + decomposer | 好氧分解者 | 分解者 |

**植物 / 动物 / 微生物** 不由 archetype 区分，由 **宏观包裹规则**（§8）在渲染层判定。

非法示例：`oxy_photo + predator` → `leaky_heterotroph`（呼吸/固碳冲突，进化中会被淘汰）。

---

## 5. 表达强度与通量公式

### 5.1 表达强度 `E`

每个 vesicle 每 tick 从**膜内主导 strand** 解码（见 §6）：

```text
E = geneticActivity × coherenceGate × envGate
```

- `geneticActivity`：沿用 S4 由复制成功率更新，表示「基因组是否在工作」。
- `coherenceGate`：三子系统在线时 =1，否则 = `0.35`（可表达但弱）。
- `envGate`：温度、光、底物、抑制项的乘积（各 0–1）。

```text
envGate_photo = light × f_CO2(CO₂) × f_O2_inhibit(O₂)   // 仅 oxy_photo
envGate_aero  = f_O2(O₂) × f_DOC(DOC)
envGate_ferment = f_DOC(DOC) × f_O2_inhibit(O₂)
```

推荐形状（preset 可配）：

```text
f_CO2(c)   = c / (c + K_CO2)
f_O2(o)    = o / (o + K_O2)
f_O2_inhibit(o) = 1 / (1 + (o/O₂_tox)²)   // 厌氧型
f_DOC(d)   = d / (d + K_DOC)
light      = clamp(sunAngle) × exp(-depth × k_depth)   // 海洋深度
```

### 5.2 代谢通量 `F`（sim 单位 / tick，写入场）

```text
F = F_max × E × biomassFactor
biomassFactor = clamp01(vesicle.radius / radiusMax)
```

**碳守恒核心**（每 tick 对 vesicle 所在场格 `cell`）：

| 通路 | ΔDOC | ΔCO₂ | ΔO₂ | Δwaste |
|------|------|------|-----|--------|
| oxy_photo | +α·F | −β·F | +γ·F | +δ·F |
| chemo_auto | +α·F | −β·F | 0 | +δ·F |
| aero_resp | −α·F | +β·F | −γ·F | +δ·F |
| ferment | −α·F | +β·F·0.5 | 0 | −δ·F |
| aero_decomp | −α·F | +β·F | −γ·F | −δ·F·1.5 |
| predator | +α·F·η | +β·F·0.3 | −γ·F·0.2 | +δ·F | 见 §5.3 |

系数 `α,β,γ,δ` 来自 preset `geneExpression.fluxCoeffs`，默认建议：

```json
{
  "alpha": 0.04,
  "beta": 0.04,
  "gamma": 0.03,
  "delta": 0.02
}
```

场更新后 **clamp** 到 `[0, max]`，防止负浓度。

### 5.3 捕食（predator）

不对「动画」表现，只对 **biomass 标量**：

```text
若 T=predator 且邻格存在 vesicle B：
  transfer = min(F_pred × k_pred, B.biomass × 0.1)
  B.biomass -= transfer
  本格 DOC += transfer × k_return   // 部分转为溶解有机碳
```

无邻格猎物 → `F` 降为 `F × 0.1`，并增加 `waste`（代谢应激）。

### 5.4 与 `metabolicFlux` / 分裂的关系

```text
metabolicFlux += k_flux × (净碳增益归一化)
membraneHealth -= k_stress × (毒性项)
fissionFitness 沿用 S4，但门槛可依赖 biomass
```

---

## 6. 膜内多 strand：主导链与冗余

沿用 S4 `storageMode: redundant`：

- **表达**：取膜内 **最长** strand 解码；若多条且 `storageMode=redundant`，表达强度 `E × 1.1`。
- **突变**：仍按复制事件在子链上发生；分裂时随机分配 interior 子集（已有机制）。
- **无膜内 strand**：`E = 0`，仅渗漏代谢（维持 S3 裸膜泡可存在但不产 O₂）。

---

## 7. 群体分化（colony + R bit3）

当 `R` bit3=1 且 `colony.members ≥ 2`：

每 `diffInterval` tick 对每个成员：

```text
若本格 DOC > 群体均值 → 倾向 T=decomposer（若基因允许 mixotroph/generalist）
若本格 light > 群体均值 → 倾向表达 oxy_photo 模块（若 M 含光能位）
```

**不改写 sequence**（避免 Lamarckian）；仅 **`effectiveT` / `effectiveM` 表观映射**：

```text
effectiveM = M 或 在允许集合内切换一项（由局部场与 junk 区 hash 决定）
```

HUD 显示「表观分工」；遗传谱系仍来自真实 sequence。

---

## 8. 宏观：植物 / 动物 / 微生物（渲染契约）

| 类型 | 条件 | 画面 |
|------|------|------|
| 微生物 | 单 vesicle 或 colony≤2 | 小圆环 |
| 植物样 | archetype ∈ 生产者 且 mobility=0 | 绿调、锚定格 |
| 动物样 | herbivore / predator | 可移动、略大 |
| 多细胞个体 | colony≥3 | 包络 + 共色，**无黏附线** |

`mobility` 由 archetype 默认表给出（生产者 0，消费者 1）。

---

## 9. 场变量（与基因表达挂钩的最小集）

| 场 id | 含义 | 与 S1 场关系 |
|-------|------|--------------|
| `CO2` | 溶解二氧化碳 | 新场 |
| `O2` | 溶解氧 | 新场 |
| `DOC` | 溶解有机碳 | 可合并 waste 或从 waste 派生 |
| `POC` | 颗粒有机碳 | 新场，分解者用 |
| `light` | 光照 | 由天体层驱动，非扩散 |
| `energy` | 代谢能量 | 保留 S1 |
| `waste` | 代谢废物 | 保留 S1 |

**不单独做** 脂肪、蛋白质场；膜脂质 = `membraneHealth`；蛋白质 = `metabolicFlux` 的隐含项。

---

## 10. 预设片段示例

```json
{
  "extends": "stage5-default.json",
  "geneExpression": {
    "headerBits": 12,
    "fluxCoeffs": { "alpha": 0.04, "beta": 0.04, "gamma": 0.03, "delta": 0.02 },
    "envK": { "CO2": 0.15, "O2": 0.08, "DOC": 0.12, "O2_tox": 0.25 },
    "F_max": 1.0,
    "nightFactor": 0.15,
    "predatorTransfer": 0.08,
    "diffIntervalTicks": 30
  },
  "replicator": {
    "L0Min": 12,
    "L0Max": 24
  },
  "fields": {
    "CO2": { "baseline": 0.35, "diffusion": 0.25, "max": 1 },
    "O2": { "baseline": 0.02, "diffusion": 0.3, "max": 1 },
    "DOC": { "baseline": 0.05, "diffusion": 0.2, "max": 1 },
    "POC": { "baseline": 0.02, "diffusion": 0.08, "max": 1 }
  },
  "atmosphere": {
    "globalCO2": 0.35,
    "globalO2": 0.02,
    "oceanEquilRate": 0.01
  }
}
```

全球 `globalO2/CO2` 与格点场每 tick 交换 `oceanEquilRate`，便于 HUD 画「大气成分」曲线。

---

## 11. 可观测指标（Smoke / 里程碑）

| 指标 | 含义 |
|------|------|
| `globalO2` | 大气氧水平 |
| `globalCO2` | 大气碳水平 |
| `trophicRichness` | 存活 archetype 种类数 |
| `producerBiomass` | 生产者生物量占比 |
| `netOCFlux` | 固碳 − 呼吸 净通量 |

**最小切片验收**（600 sim s，seed 42）：

1. 存在 `cyanophyte` 谱系且 `globalO2` 上升 ≥ `ΔO2_min`（如 0.05）。
2. 出现至少一种异养 archetype 且 DOC 发生波动（食物网闭合雏形）。
3. 无碳凭空增加（守恒检查 `sum(DOC+POC+biomass)+CO2` 漂移在容差内）。

---

## 12. 实现顺序（建议）

1. `gene-expression.js`：`decode(sequence)` + `archetype(M,T)` + `fluxTable`  
2. 场 `CO2/O2/DOC` + 全球大气标量  
3. `chemoton.updateMetabolism` 末尾调用 `applyGeneFlux(vesicle, fields)`  
4. HUD sparkline：`globalO2`、`trophicRichness`  
5. 捕食与 colony 表观分化  
6. 里程碑弹幕：`大氧化事件`、`厌氧带收缩`

---

## 13. 已确认设计决策（2026-08-14）

| 议题 | 决定 |
|------|------|
| 成核最短序列 | **接受 `L0Min = 12`**；`length < 12` 仅渗漏代谢，不产 O₂ |
| 捕食表现 | **仅 `biomass` 标量转移**，无捕食动画；产物部分进入 DOC |
| 群体分工 | **允许表观分化**（`effectiveM` / `effectiveT`），**不写回 sequence**；遗传变异仍靠复制突变 |
| preset 路线 | `stage-earth-default` **extends `stage5-default`**，不替换 S1–S5 |
| 快照导出 | 表观分工写入快照（`effectiveArchetype` 字段），便于教学回放 |

## 14. 仍待下一轮（剖面 UX · B）

- 剖面坐标 `y` 与 `light(depth)` 的精确映射  
- 地球切面横向滑动 = 自转的像素与分层高度  

---

## 15. 代码索引（规划）

| 文件 | 职责 |
|------|------|
| `site/js/gene-expression.js` | 解码、archetype、通量（E1 ✅） |
| `site/js/fields.js` | 扩展 CO₂/O₂/DOC/POC |
| `site/js/chemoton.js` | 调用通量、更新 flux |
| `site/js/biology-names.js` | archetype 中文名 |
| `docs/EARTH_GENE_EXPRESSION.md` | 本文档 |
