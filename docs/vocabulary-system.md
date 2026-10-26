# Kachi 词库系统设计

> 2026-10-26 制定。依据是 172 条真实财经标题 + 6 篇完整正文（约 2,300 词）的实测词频，
> 不是凭感觉列词。每一条分层判断都能回溯到语料证据。

## 一、为什么要重做词库

现有 40 个概念在真实语料里的表现：

| 语料                 | 现有 40 词命中     | 说明                                                    |
| -------------------- | ------------------ | ------------------------------------------------------- |
| 172 条标题           | **10 / 40（25%）** | 命中的是 `bond`(41)、`yield`(18)、`inflation`(8) 这几个 |
| 6 篇正文（2,300 词） | **12 / 40（30%）** | 加上 `premium`、`liquidity`、`futures`、`swap`、`hedge` |

剩下 28–30 个词在真实语料里**一次都没出现**：`pledge`、`haircut`、`notional`、`contango`、
`backwardation`、`cost of carry`、`securities-backed loan`、`buy-borrow-die`、`mark-to-market`。

反过来，语料里出现频率最高的词，一个都不在现有词表里：

```
crude(11)  copper(11)  earnings(7)  capital(7)  profit(7)  demand(5)
capacity(4)  selloff(4)  policy(4)  investor(3)  dividend(3)  debt(3)
treasury(3)  hike(3)  benchmark(3)  portfolio(3)
```

**结论：现有词表是一套「私人银行结构性产品」的术语，不是「财经英语」。**
产品名和内容对不上。一个人学完 40 课，读不懂一条普通的 BHP 财报新闻。

## 二、词库分三层，不是一堆词

按「读什么」而不是「属于哪个学科」分层。每层有明确的验收句：学完能读懂什么。

### T1 · 读财经首页（42 词）

**验收：打开任何财经 App 首屏，标题全看得懂。**

语料验证：这 42 词在 172 条标题里命中 **344 次**，零命中率 **3%**（1/42）。

```
股票与市场  stock  share  market  index  investor  blue chip  rally  selloff  slump  rebound  rout
价格与供需  price  supply  demand  output  capacity  inventory  surplus  deficit  tariff
公司与业绩  profit  revenue  earnings  margin  dividend  forecast  estimate  consensus  guidance
债券与利率  bond  yield  treasury  auction  issuance  inflation  interest rate  rate hike  rate cut
货币与宏观  dollar  currency  central bank  monetary policy
```

**这是重做的核心。** 现有 40 词里只有 `bond`/`yield`/`inflation`/`interest rate` 四个能进这一层。

### T2 · 读公司财报（44 词）

**验收：读一份季报快讯，知道在说好还是坏。**

语料里 `earnings(7)` `profit(7)` `dividend(3)` `consensus(2)` `guidance(1)` 高频，而 `revenue`、
`buyback`、`valuation` 虽然语料零命中，但财报是它们的主场——这一层的语料应该用财报稿而不是新闻标题。

```
业绩口径    earnings  revenue  profit  margin  gross  net  eps  consensus  beat  miss
指引与预期  guidance  forecast  estimate  outlook  headwinds  tailwinds
股东回报    dividend  buyback  payout  yield  shareholder  share issuance
资本结构    capex  opex  debt  equity  leverage  net debt  working capital  free cash flow
公司事件    ipo  listing  acquisition  merger  divestiture  spin-off  write-down  impairment  restructuring
估值        valuation  p/e  p/b  market cap  book value
```

### T3 · 读债券与利率（37 词）

**验收：读懂债市新闻——收益率、拍卖、期限。**

这是现有内容最强的域（`bond` 41 次、`yield` 18 次、`auction` 8 次），保留并补全。

```
基础        bond  yield  price  coupon  maturity  duration  principal
发行与交易  auction  issuance  bid-to-cover  cut-off yield  primary dealer  benchmark
品种        treasury  gilt  sovereign  corporate bond  commercial paper  junk bond  investment grade
利差与曲线  credit spread  spread widening  spread tightening  yield curve  term premium  inversion
风险        default risk  credit rating  downgrade  upgrade  covenant  refinancing
政策        policy rate  basis point  inflation-linked  fixed-rate  floating-rate
```

### T4 · 读外汇与宏观（36 词）

**验收：看懂汇率、央行、政策这类新闻。**

语料：`euro(6)` `yen(6)` `dollar(4)` `hike(3)` `policy(4)`。

```
汇率        currency  exchange rate  dollar  euro  yen  sterling  yuan  peso  rupiah
方向        appreciate  depreciate  weaken  strengthen
央行        central bank  rate hike  rate cut  hawkish  dovish  forward guidance  tapering
政策        monetary policy  fiscal policy  quantitative easing  tightening  easing
宏观        inflation  deflation  stagflation  soft landing  current account  trade balance
市场情绪    risk appetite  risk-off  safe-haven  carry trade  intervention
```

### T5 · 读研报与量化（32 词）—— 配 audit 题型

**验收：判断一份回测结论哪里站不住。**

这一层的价值不在词本身，在于它天然要求「疑」：每个词都对应一种自欺方式。

```
回测        backtest  in-sample  out-of-sample  walk-forward  benchmark
陷阱        overfitting  look-ahead bias  survivorship bias  data snooping  multiple testing
绩效        sharpe ratio  max drawdown  hit rate  expectancy  alpha  beta  tracking error
组合        universe  rebalance  position sizing  turnover  correlation  exposure
成本        transaction cost  slippage  capacity constraint  liquidity constraint
风险        stress test  scenario analysis  value at risk  sensitivity  robustness
```

### T6 · 借款与对冲（现有 pack 保留，40 词）

**验收：读私人银行、结构性产品这类专业材料。**

现有 40 词基本都在这一层，保留原样。它是真专业内容，只是不该当入门层。

`hedge` `pledge` `collateral` `haircut` `margin` `margin call` `leverage` `derivative` `option`
`put` `call` `short selling` `notional` `premium` `volatility` `diversification` `counterparty`
`mark-to-market` `futures` `swap` `spot` `basis` `basis risk` `contango` `backwardation`
`cost of carry` `real rate` `securities-backed loan` `capital gains` `buy-borrow-die`
`duration` `yield curve` `quantitative easing` `default` `long` `interest rate` `bond`
`inflation` `yield` `liquidity`

> 注意：`interest rate` / `bond` / `yield` / `inflation` / `liquidity` 在 T1/T3 已出现。
> 跨 pack 重复的词**不重复教学**，只作为该 pack 内的复习项（见第四节「跨 pack 去重」）。

**总计 231 个词条 / 198 个唯一词 / 6 个 pack。** 现有 40 词全部保留在 T6，一个不丢。

## 三、混淆对必须重做：现有 33 对里只有 3 对是真易混

`mixUp` 是 Kachi 的核心机制（整个弦图、mastery 调度、练习池都建在它上面）。
我把现有 33 对逐个检查了「两个词是否真的会混」：

**真易混（同词根/同形/同场高频对立）只有 3 对：**
```
interest rate ↔ real rate      （名义 vs 实际）
yield ↔ yield curve            （一个点 vs 一条线）
basis ↔ basis risk             （缺口 vs 缺口造成的伤害）
```

**其余 30 对是「同主题的近邻概念」，不是「会混的词」：**
```
volatility ↔ diversification      ← 一个是单资产波动，一个是组合分散，没人会把它们看混
counterparty ↔ default            ← 「是谁」vs「没履约」，语义正交
liquidity ↔ notional              ← 毫无关系
premium ↔ yield                   ← 一个是价格，一个是回报率
```

这不影响现有体验（作为「概念对照」依然有教学价值），但**它撑不起 mastery 的判据**：
`consecutiveCorrect` 记的是「这个 pair 你连对了几次」，如果 pair 本身不是易混对，
这个数字测的是「你记住了两个不相干的定义」，不是「你不再混淆」。

**重做原则（新 pack 一律照此）：**

| 混淆类型 | 判据                       | 例子                                                       |
| -------- | -------------------------- | ---------------------------------------------------------- |
| 形近     | 拼写相近或同词根           | `depreciate` / `appreciate`、`principal` / `principle`     |
| 义反     | 同一维度上的两端           | `supply` / `demand`、`hike` / `cut`、`surplus` / `deficit` |
| 同场高频 | 同一句话里同时出现且易互换 | `profit` / `revenue`、`margin` / `markup`                  |
| 层级     | 一个是另一个的子类         | `option` / `derivative`、`gilt` / `treasury`               |
| 时序     | 同一动作在不同时点         | `ex-dividend` / `record date`、`auction` / `issuance`      |

T1 的混淆对举例（都是语料实证过的高频词）：
```
supply ↔ demand          （义反，语料 supply 3 / demand 5）
profit ↔ revenue         （同场，profit 7）
earnings ↔ profit        （同场，earnings 7）
hike ↔ cut               （义反，hike 3 / cut 1）
surplus ↔ deficit        （义反）
rally ↔ selloff          （义反，selloff 4）
bond ↔ yield             （同场，bond 6 / yield 4，且方向相反——最经典的财经误解）
```

## 四、跨 pack 去重与复习

231 个词条里有 28 个跨 pack 出现（对应 198 个唯一词），如 `bond`/`yield`/`inflation`/`interest rate`/
`liquidity`/`premium`/`futures`/`swap`/`hedge`/`leverage`/`default`/`margin`。

规则：
1. **首次出现处教学**，后续 pack 只作为「复习项」出现，`mastery` 跨 pack 共享（同一个 concept id）。
2. `contentVersion` 按 pack 独立，但 `mastery` 的 key 是 `pairIdForConcepts`，天然跨 pack 可复用。
3. pack 选择界面上标「含 N 个已学词」，让学习者知道不是全新的。

## 五、数据结构改动（最小）

现有 schema 已经支持多 pack（`packId` / `contentVersion` / `packs/` 目录），缺三样：

1. **pack 注册表**：`content/packs/index.json`，列出每个 pack 的 `id` / `title` / `level`（T1–T6）/ `prerequisite` / `conceptCount`。
2. **`loadCourse` 支持指定 pack**：现在硬编码 `hedge-or-pledge`，改成按学习者选择的 pack 加载。
3. **pack 进度隔离**：`completedLessonIds` 需要带 pack 前缀，否则 `u1l1` 在不同 pack 里会撞。

`localization.ts` 的 `termZh` 映射是全局的，多 pack 时需要合并成一张总表（按 concept id，天然唯一）。

## 六、内容生产流程（防再走偏）

这次的问题不是「词选错了」，是**没有验证环节**。加两条门禁：

1. **词表必须先过语料检验**：新增 pack 的每个词，必须在目标语料里出现过 ≥1 次。
   `scripts/validate-content.mjs` 加一条：读 `content/corpus/<pack>.txt`（该 pack 的目标语料），
   校验每个 `concept.term` 至少命中一次。没语料的词要么补语料，要么说明为什么教它。
2. **混淆对必须有类型**：`mixUp` 加一个 `mixUpType` 字段（`form` / `opposite` / `cooccur` / `hypernym` / `timing`），
   校验器拒绝空值。这强迫作者回答「这两个词为什么会混」，而不是「它们同属一个主题」。

## 七、执行顺序

```
1. 语料固化   把 T1–T5 各自的目标语料存进 content/corpus/（新闻标题 + 正文，各 3–5 篇）
2. T1 先做    40 词 + 混淆对 + 23 课，这是唯一能立刻验证「学完能读懂首页」的层
3. 门禁先上   validate-content 加语料检验 + mixUpType 校验，再写 T2
4. T2→T5     按语料密度顺序（T2 财报、T3 债券已有基础、T4 宏观、T5 量化配 audit 题型）
5. T6 保留    现有 pack 改名并标为「进阶」，内容不动
```

**验收标准（可测）**：T1 完成后，随机抽 20 条当天真实财经标题，
让「学完 T1」的模型（或人）逐条判断「看懂了 / 看不懂」，命中率应 ≥90%。
