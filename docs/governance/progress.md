# 架构降熵治理 · 进度文件（032_Kachi）

> 精简版治理（高规整度仓库）：扫描 → 熵清单 → 删除 → 验证 → 终态。
> worktree 分支 `governance/arch-20261128`；`pnpm run check`（lint→typecheck→test→build）全绿方可提交。

## 基线（2026-11-28，main@ba8ceb6）

- vitest 311 pass（28 文件）；check 全绿（worktree 复验同绿）。
- 结构：src/domain（领域词汇表+类型）、engine（关卡引擎）、schema（内容校验）、screens、
  scripts（generate-course/art/audio/icon/og + validate-content + build-ipa 生成管线），
  styles.css 211 类 + styles-coverage.test（关键规则存在性单向守卫，历史上有过尾部规则
  被整段重写丢掉的事故——该测试因此而生）。

## 熵清单（2026-11-28）

- **E1 死导出 7 个**：art.tsx `Hedgehog`/`NAV_ICONS`、domain/index.ts
  `LocalizedTerm`/`ContentPackManifest`/`LearningEvent`/`LearnerProjection`、
  localization.ts `localizedTerm`——全语料（src/scripts，含测试）零引用。
- **E2 domain/index.ts 顶部注释重复**：listen 段落以 `/** */` 与 `//` 两种形式连写两遍。
- **E3 CSS 动态类面**：20 个「静态孤儿」全部为模板生成（`kind-${type}`、`type-${type}`、
  `twin-${side}`、`tf-${yes|no}`、`l${level}`）——非熵项，但无守卫固化这条区分规则，
  未来误报或真孤儿都可能无人分辨。

## 勘察排除项（健康结构，未动）

- styles.css 零真孤儿；styles-coverage.test 已有关键规则守卫；
  scripts 生成管线均有 test 或 validate-content 校验；依赖全部有真实使用。

## 终态（2026-11-28，治理收敛）

- vitest 311 pass 不变（纯删除零行为面）；check 全绿。
- CSS 侧无真孤儿（20 个静态候选全为模板生成态），styles-coverage.test 已覆盖关键规则存在性，
  本轮不另加守卫——该仓已有的单向守卫 + 动态类判定成本高于收益，明释记录于此。
- 净变化：约 -140 行纯删除。

## 第二遍（2026-11-28，R2）

- 深扫复核：其余 9 个导出候选（hasAsset/unlockedUnitIds/blankTerm/lessonPair/validateCourse 等）
  全部有真实消费方（首轮扫描语料漏了测试与生成脚本）——全语料复核是必须步骤。
- HEDGEHOG_PATHS 删除：R1 删 Hedgehog 组件后其伴生 SVG 路径常量随之成孤（级联死代码，
  二次扫描的价值所在）；termSvg 为非导出内部函数，保留。
- 020_veryfunstudio.github.io 深扫同步执行：13 个候选全为误报（框架约定导出 +
  测试消费方），无需改动。

## 轮次记录

| 轮  | 内容 | Commit |
| --- | ---- | ------ |
