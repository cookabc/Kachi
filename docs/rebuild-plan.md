# Kachi 词库推倒重来方案

> 2026-10-26。已确认决策：六层全做（231 词）、插画用 imagen 经 codex 生成。
> 本文档是执行依据，所有数字都已实测，不是估计。

## 一、要推倒成什么样

按 [vocabulary-system.md](vocabulary-system.md) 的六层，`content/packs/` 变成：

```
content/packs/
  t1-finance-news/    读财经首页  (42 词)   ← 新
  t2-company-earnings/ 读财报     (44 词)   ← 新
  t3-bonds-rates/     读债券利率  (37 词)   ← 新
  t4-forex-macro/     读外汇宏观  (36 词)   ← 新
  t5-quant-research/  读研报量化  (32 词)   ← 新，配 audit 题型
  t6-hedge-pledge/    借款与对冲  (40 词)   ← 现有 pack 改名保留
```

每个包结构不变：`{en-US,zh-CN}/course.json`，一套 schema，中英双语内部保持 parity。

## 二、工程量（已实测）

| 项                | 量                                       |
| ----------------- | ---------------------------------------- |
| 概念总文本        | 46,600 字符（231 概念 × 中位 134/概念）  |
| 题目总文本        | 113,000 字符（约 1,200 题 × 中位 94/题） |
| 文字合计          | 约 160 千字符 = **6.5× 现有量**          |
| 插画              | 约 190 张（可选参数化降为 20 母题）      |
| 音标/例句（后续） | 每词 IPA + 中英定义                      |

这是**重做一个产品的量**，必须分阶段推进，不能一次写完。

## 三、决定成败的硬约束：插画体系

`src/art.test.ts` 有一条硬测试：**每个概念必须有 `HERO_ART` 图**，否则测试红、且界面回落成 `joke` 图。

现有 40 概念的图是**手绘内联 SVG 字符串**（`art.tsx` 里 44 条 `termSvg(...)`）。推倒到 231 概念后：

- 手绘不 scale（190 张 × 手工 SVG = 不可行）
- 但 **schema 需要图按 id 引用**，`art.tsx` 的 `TERM_ART`/`HERO_ART` 是 React 内联，不是文件

**所以美术系统必须从「内联 SVG 字符串」迁到「外部图片文件 + 清单」**。这是本次重构最大的结构变化，也直接呼应你的「用 imagen 生成」：

```
public/art/{id}.webp        # 231 张
src/art.tsx                # 从手绘 SVG 改为 import 图片 + 尺寸映射
art.test.ts                # 断言改为「每个概念 id 都在 public/art/ 有文件」
```

## 四、imagen → codex 生成链路（已核实基础）

你机器上有 `codex exec`（v0.164，非交互可跑），且 `~/.codex/generated_images/` 已存在 —— codex 生图在这台机器上**跑通过**。参考词光的做法：

- 统一画风提示词（STYLE 块：配色、扁平几何、无文字）
- 每个概念一个 `scene` 描述 + 统一 STYLE → 一条 prompt
- `--follow` 顺序取，输入填概念 seed，`--workers N` 并发
- 写 `.part.webp` 再 rename，保证原子
- `gpt-image-2.5-flare` 或 codex 默认生图模型

**风险点**：codex 生图的命令形态、输出目录、token/额度、是否需 auth，得先跑通一条真实调用才能定写。这是方案里标注的「必须先验证」项，不能假设。

## 五、多 pack 的结构改动（最小集）

从「单 pack + 双语」到「多 pack」需要改 4 处，现有机制已部分支持：

1. **`content/packs/index.json`**：pack 注册表（id / title / level T1–T6 / prerequisite / from / description）。新增。
2. **`src/course.ts` 的 `loadCourse`**：现在硬编码 `hedge-or-pledge` + 按 lang 懒加载。改成按「用户选中的 pack + lang」加载，pack id 进 URL（如 `#/packs/t1/...`）支持分享与回访。
3. **pack 进度隔离**：`completedLessonIds` / mastery 的 key 现在按 `u1l1` / `pairId` 全局唯一。跨 pack 时 `u1l1` 会撞。加 pack 前缀：`t1/u1l1`，`completionKey = "${packId}/${lessonId}"`。
4. **跨 pack 去重**：231 里有 28 个词跨包出现（`bond` 在 T1/T3/T6）。规则：首次出现的包教学，后续包只作复习项（复用同一 concept id，mastery 共享）。

## 六、阶段计划（每步都保测试绿）

| 阶段            | 内容                                                                  | 门禁/验收                         |
| --------------- | --------------------------------------------------------------------- | --------------------------------- |
| **F0 管线验证** | 用 codex 真实生成 2 张图，确认命令/输出/授权；搭图片总线              | 2 张图落盘，无需人工              |
| **F1 多包地基** | packs/index.json + loadCourse 多包 + 进度前缀 + art 迁移到文件        | 现有 40 词回归绿，能显示 t1 空包  |
| **F2 内容地基** | 生成 T1+... 全部 6 层文案（概念/题/混淆对）按层分批                   | 每层过 schema + parity + 语料门禁 |
| **F3 插画批量** | 按层生成 231 张图，并行                                               | 每张非 joke，文件存在断言过       |
| **F4 收尾**     | audio（后置）、audit 题型（T5 用）、pack 选择 UI、Old pack 标「进阶」 | 全量验收                          |

**先后手**：F1（多包地基）必须先于 F2（内容），否则 6 层内容无处安放。F0（生图管线）又必须先于 F3，因为要确认命令形态。所以 F0→F1→F2→F3→F4 是硬顺序。

## 七、先不做的（避免摊子铺太大）

- **audio**：后置。图片 + 文案能先撑住，音频是独立的服务（fish.audio + IPA），不阻塞多包结构。
- **audit 题型已经是中立能力**，schema 能加，但 UI 题面、结果反馈、why 讲解都要设计，放 T5 阶段。
- **跨 pack 去重**的 UI 提示（「含 N 个已学词」）放 F4。

## 八、F0 已完成：codex 生图管线验证通过

2026-10-26 实测跑通，证据与实现细节见 [art-pipeline.md](art-pipeline.md)。要点：

- ✅ 单张 / 批量 / 风格锁定 / 混淆对双生，四项能力全部成立
- ✅ 三张同批生成的线宽、投影、色板完全一致（画风块逐字复用即可，不漂）
- ⚠️ 输出先落到 `~/.codex/generated_images/<uuid>/`，脚本必须自己找最新文件再 rename
- ⚠️ 单张约 25k tokens，190 张 ≈ 475 万 tokens，**需先确认额度与单日限制**

**风险已从「能不能生成」降级为「额度够不够」，属于可协商项，不阻塞 F1。**
