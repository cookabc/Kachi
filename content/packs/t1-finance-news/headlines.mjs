// 「读真新闻」练习的数据源。
//
// 每个条目是一句**照财经头条句法原创**的英文标题，句子里同时出现一对易混词。
// 不抄 content/corpus 的原文——那里的标题只用于词频验证，不进课程（见该目录 README）。
//
// 每题考的是「哪个词在这里成立」，而不是「这个词是什么意思」：两句话用同一批词，
// 只有一处语法/语义成立。这才是读真新闻时实际发生的事。
//
// 字段：
//   id     稳定 id，进 attempts 日志，不要改名
//   a/b    易混对的两个概念 id（必须在 course.json 的 concepts 里）
//   text   标题；**用 ____ 标出被考的那个空**
//   answer 空里应该填的概念 id（a 或 b）
//   why    为什么另一个不成立——这一句是教学载荷，不要写成同义反复

export const HEADLINE_DRILLS = [
  {
    id: "h-rally-selloff",
    a: "rally",
    b: "selloff",
    text: "Oil prices staged a sharp ____ after three days of heavy selling, recovering 4%.",
    answer: "rally",
    why: "「recovering 4%」是跌完之后的回升；rally 推高价格，selloff 把价格砸下去。",
    whyEn:
      "“recovering 4%” is the bounce after a fall: a rally pushes prices up, a selloff slams them down.",
  },
  {
    id: "h-selloff-rally",
    a: "selloff",
    b: "rally",
    text: "A broad ____ in government bonds pushed yields to their highest level in a decade.",
    answer: "selloff",
    why: "收益率创高意味着价格在跌：selloff 压低价格，rally 把价格推高、压低收益率。",
    whyEn:
      "Yields at a decade high mean prices are falling: a selloff pushes prices down, a rally pushes yields down.",
  },
  {
    id: "h-slump-rebound",
    a: "slump",
    b: "rebound",
    text: "Copper extended its ____ into a fourth week as Chinese demand kept weakening.",
    answer: "slump",
    why: "「extended into a fourth week」是延续下跌：slump 一直往下走，rebound 是跌完弹回来。",
    whyEn:
      "“Extended into a fourth week” means the decline continues: a slump keeps going down, a rebound bounces back.",
  },
  {
    id: "h-rebound-slump",
    a: "rebound",
    b: "slump",
    text: "Shares staged a modest ____ on Tuesday, clawing back part of Monday's losses.",
    answer: "rebound",
    why: "「clawing back losses」是收复失地：rebound 弹回来，slump 让亏损继续扩大。",
    whyEn:
      "“Clawing back losses” is recovery: a rebound bounces up, a slump deepens the loss.",
  },
  {
    id: "h-rout-selloff",
    a: "rout",
    b: "selloff",
    text: "Treasuries suffered a disorderly ____, with buyers vanishing and spreads blowing out.",
    answer: "rout",
    why: "「disorderly」+「buyers vanishing」是恐慌失序：rout 比普通 selloff 更剧烈。",
    whyEn:
      "“Disorderly” with “buyers vanishing” is panic: a rout is more violent than an ordinary selloff.",
  },
  {
    id: "h-supply-demand",
    a: "supply",
    b: "demand",
    text: "Iron ore slid as rising ____ from Australian miners overwhelmed weak Chinese buying.",
    answer: "supply",
    why: "「from miners」+「overwhelmed」是卖方供货增加把价格压低：supply 是能卖的量，demand 是买方想买。",
    whyEn:
      "“From miners” and “overwhelmed” mean sellers added volume: supply is what sellers bring, demand is what buyers want.",
  },
  {
    id: "h-demand-supply",
    a: "demand",
    b: "supply",
    text: "Copper rose as ____ from grid and EV makers outpaced mine additions.",
    answer: "demand",
    why: "「from grid and EV makers」是买方，超过矿山新增产量：demand 是买方想买，supply 是卖方能卖。",
    whyEn:
      "“From grid and EV makers” is the buy side outpacing new mine output: demand is what buyers want, supply is what sellers bring.",
  },
  {
    id: "h-capacity-output",
    a: "capacity",
    b: "output",
    text: "The smelter ran at 78% of ____, idling the rest of its lines.",
    answer: "capacity",
    why: "百分比描述的是「满负荷上限」的利用程度：capacity 是上限，output 是实际产出。",
    whyEn:
      "A percentage describes how much of the ceiling is used: capacity is the ceiling, output is what actually came out.",
  },
  {
    id: "h-inventory-output",
    a: "inventory",
    b: "output",
    text: "Copper falls as rising ____ ease supply concerns.",
    answer: "inventory",
    why: "「rising」的是库存存量：inventory 会累积，output 是一段时间内造出来的量。",
    whyEn:
      "What “rises” is accumulated stock: inventory builds up, output is what a period produced.",
  },
  {
    id: "h-surplus-deficit",
    a: "surplus",
    b: "deficit",
    text: "The country swung to a trade ____, importing far more than it exported.",
    answer: "deficit",
    why: "进口远多于出口是缺口：deficit 是缺的那块，surplus 是多出来的部分。",
    whyEn:
      "Importing far more than exporting is a shortfall: a deficit is the gap, a surplus is the leftover.",
  },
  {
    id: "h-earnings-revenue",
    a: "earnings",
    b: "revenue",
    text: "The bank's ____ fell 12% after provisions for bad loans ate into the top line.",
    answer: "earnings",
    why: "「拨备吃掉了收入」之后剩下的是利润：earnings 是扣完成本的，revenue 是扣之前的总额。",
    whyEn:
      "What survives after provisions is profit: earnings are after costs, revenue is the top line before them.",
  },
  {
    id: "h-revenue-earnings",
    a: "revenue",
    b: "earnings",
    text: "The retailer's ____ grew 8%, but margins compressed as discounting spread.",
    answer: "revenue",
    why: "能「增长」同时又「利润率压缩」的是收入总额：revenue 是总收入，earnings 是扣完成本后的。",
    whyEn:
      "What grows while margins compress is the top line: revenue is gross, earnings are what survives the costs.",
  },
  {
    id: "h-margin-profit",
    a: "margin",
    b: "profit",
    text: "The group's gross ____ widened to 42% on better product mix.",
    answer: "margin",
    why: "42% 是比率：margin 是利润占收入的比例，profit 是绝对金额。",
    whyEn:
      "42% is a ratio: margin is profit as a share of revenue, profit is an absolute amount.",
  },
  {
    id: "h-dividend-earnings",
    a: "dividend",
    b: "earnings",
    text: "The board raised the quarterly ____ by 6%, even as ____ fell year on year.",
    answer: "dividend",
    why: "董事会「raise」的是分给股东的那笔钱：dividend 从利润里分出，earnings 是公司赚到的。",
    whyEn:
      "What a board raises is the payout to shareholders: a dividend is carved out of earnings, earnings are what the company made.",
  },
  {
    id: "h-guidance-forecast",
    a: "guidance",
    b: "forecast",
    text: "The company cut its full-year ____, warning of softer orders in Asia.",
    answer: "guidance",
    why: "公司自己给出的官方预期是 guidance；forecast 可以是任何人对任何事的预测。",
    whyEn:
      "The company's own official number is guidance; a forecast can come from anyone about anything.",
  },
  {
    id: "h-consensus-estimate",
    a: "consensus",
    b: "estimate",
    text: "Results beat the analyst ____ of $1.20 a share, sending the stock higher.",
    answer: "consensus",
    why: "「the analyst」+ 逐字比的结果是所有人预测的平均值：consensus 是合体，estimate 是单个数。",
    whyEn:
      "“The analyst” plus a beat means the blended average: consensus is everyone combined, an estimate is one person's number.",
  },
  {
    id: "h-bond-yield",
    a: "yield",
    b: "bond",
    text: "The 10-year ____ climbed to 4.6% as investors demanded more compensation for risk.",
    answer: "yield",
    why: "4.6% 是回报率：yield 是回报率，bond 是那张凭证本身。",
    whyEn:
      "4.6% is a return rate: yield is the return, a bond is the certificate itself.",
  },
  {
    id: "h-inflation-rate",
    a: "inflation",
    b: "interest rate",
    text: "Consumer ____ eased to 2.1%, giving the central bank room to pause.",
    answer: "inflation",
    why: "「eased to 2.1%」且能给央行留空间的是物价涨幅：inflation 是问题，interest rate 是工具。",
    whyEn:
      "What “eases” and gives the central bank room is price growth: inflation is the problem, the interest rate is the tool.",
  },
  {
    id: "h-rate-hike-cut",
    a: "rate hike",
    b: "rate cut",
    text: "The central bank delivered a surprise ____, trimming its benchmark by 25 basis points.",
    answer: "rate cut",
    why: "「trimming」是往下调：rate cut 降息，rate hike 加息。",
    whyEn:
      "“Trimming” moves rates down: a rate cut lowers, a rate hike raises.",
  },
  {
    id: "h-currency-exchangerate",
    a: "exchange rate",
    b: "currency",
    text: "The ____ slid past 160 per dollar, prompting officials to warn about one-way moves.",
    answer: "exchange rate",
    why: "「160 per dollar」是两种货币的兑换比：exchange rate 是比例，currency 是那种钱本身。",
    whyEn:
      "“160 per dollar” is the ratio between two monies: the exchange rate is the ratio, currency is the money itself.",
  },
  {
    id: "h-appreciate-depreciate",
    a: "appreciate",
    b: "depreciate",
    text: "The yen ____ to its strongest level since 2022 on a weaker dollar.",
    answer: "appreciate",
    why: "「strongest level」是变值钱：appreciate 升值，depreciate 贬值。",
    whyEn:
      "“Strongest level” means more valuable: appreciate is stronger, depreciate is weaker.",
  },
  {
    id: "h-valuation-marketcap",
    a: "valuation",
    b: "market cap",
    text: "Analysts flagged stretched ____ in the energy sector after a 40% run.",
    answer: "valuation",
    why: "「stretched」是判断值不值：valuation 是估出来的，market cap 是市场当下给的价格总和。",
    whyEn:
      "“Stretched” is a judgement of worth: valuation is the estimate, market cap is the total price the market assigns.",
  },
  {
    id: "h-bluechip-index",
    a: "blue chip",
    b: "index",
    text: "The ____ has added 12% this year, led by a handful of large-cap names.",
    answer: "index",
    why: "「has added 12%」是一篮子股票算出的整体数字：index 是算出来的数，blue chip 是其中一类公司。",
    whyEn:
      "What “has added 12%” is a computed figure: an index is the number, a blue chip is one of the companies inside it.",
  },
  {
    id: "h-auction-issuance",
    a: "issuance",
    b: "auction",
    text: "Record ____ of government debt this quarter is straining dealer balance sheets.",
    answer: "issuance",
    why: "「Record … of debt」说的是发行总量：issuance 是发行本身，auction 是发行时的竞价方式。",
    whyEn:
      "“Record … of debt” is the total brought out: issuance is the act, an auction is one way to price it.",
  },
];
