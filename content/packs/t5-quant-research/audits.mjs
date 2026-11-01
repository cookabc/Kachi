// Original teaching cases, not quotations or actual fund results. All figures
// are hypothetical. The English excerpt is shared by both course editions.
// Concepts retain their textbook/paper citations in source.mjs. Method checks:
// https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf
// https://rpc.cfainstitute.org/-/media/documents/code/gips/case-study-risk-adjusted-performance-measures.pdf
// https://www.investor.gov/introduction-investing/getting-started/asset-allocation
// Each question has one answer to its explicit stem. Distractors are competing
// diagnoses or conclusions, rather than unrelated true statements.
function bilingual({ claim, answer, zh, en }) {
  return { zh: { claim, answer, ...zh }, en: { claim, answer, ...en } };
}

export const AUDITS = {
  backtest: bilingual({
    claim: "Our backtest returned 18% a year before fees and slippage. Investors should expect 18% net in live trading.",
    answer: 1,
    zh: {
      stem: "从历史结果推到实盘预期，哪一步有问题？",
      options: ["年化收益应当改成各年收益的简单相加。", "把未扣成本的模拟收益当成了实盘净收益预期。", "回测只要包含十年数据，就应当使用月收益。", "只要补上最大回撤，就能确认实盘的净收益。"],
      why: "before fees and slippage 表示尚未扣除费用与滑点，net 表示扣除成本之后。两种口径不能直接等同；即使补齐成本，历史回测也不保证未来收益。",
    },
    en: {
      stem: "Which step from historical results to live expectations is flawed?",
      options: ["Annual returns should be replaced by the sum of all yearly returns.", "Simulated returns before costs are being treated as expected live net returns.", "Any backtest covering ten years must use monthly returns.", "Adding maximum drawdown would establish the expected live net return."],
      why: "Before fees and slippage is a gross figure; net is after costs. These are different measures. Even a cost-adjusted backtest does not guarantee future returns.",
    },
  }),
  "in-sample": bilingual({
    claim: "We tuned the model on 2015-2024 data. Its Sharpe on that same period is 1.4, which we present as independent validation.",
    answer: 2,
    zh: {
      stem: "这里的 independent validation 为什么不成立？",
      options: ["夏普为正说明模型的参数数量一定过少。", "十年数据不能用于任何形式的模型训练。", "评估与调参使用同一段数据，不是独立检验。", "只有夏普超过 2，评估才算独立检验。"],
      why: "same period 是关键：样本内数据已用于选择参数，其表现不能再充当独立证据。可以如实报告样本内夏普，但应标明口径，并补充未参与选择的数据上的检验。",
    },
    en: {
      stem: "Why is this not independent validation?",
      options: ["A positive Sharpe means the model must have too few parameters.", "Ten years of data cannot be used to train any model.", "Evaluation reuses the period used to tune the model.", "Validation becomes independent only if the Sharpe exceeds 2."],
      why: "Same period is the clue: the data already influenced parameter selection. The in-sample Sharpe can be reported with that label, but independent evidence needs data not used for selection.",
    },
  }),
  "out-of-sample": bilingual({
    claim: "We checked the holdout every week and changed the model whenever its holdout Sharpe fell. The final holdout Sharpe is 1.2.",
    answer: 0,
    zh: {
      stem: "下一步怎样才能获得更独立的证据？",
      options: ["冻结模型，用尚未查看的新数据检验。", "继续修改模型，直到这段留出数据上的夏普更高。", "把这段留出数据重新命名为样本外即可。", "把每周查看改成每月查看，继续在原数据上调参。"],
      why: "holdout 一旦反复指导改模型，就参与了选择，失去了原本的独立性。先冻结规则，再用新的未查看数据检验；改名或降低查看频率不能消除已经发生的信息泄漏。",
    },
    en: {
      stem: "What would provide more independent evidence next?",
      options: ["Freeze the model and test it on new, unseen data.", "Keep changing the model until its Sharpe on this holdout rises.", "Simply rename the same holdout out-of-sample.", "Check monthly instead, while continuing to tune on the same holdout."],
      why: "A holdout that repeatedly guides model changes becomes selection data. Freeze the rules before using fresh unseen data. Renaming the old holdout or checking it less often cannot undo that reuse.",
    },
  }),
  "walk-forward": bilingual({
    claim: "Our walk-forward test refits each January using the full 2010-2024 dataset, then simulates trades for that year, including 2018.",
    answer: 3,
    zh: {
      stem: "要符合滚动验证的时间约束，应改哪一步？",
      options: ["每次拟合改用更多未来年份，减少参数波动。", "只改成按月拟合，仍使用完整数据集。", "先把完整数据随机打乱，再模拟每年的交易。", "每次拟合只使用该交易时点之前已能获得的数据。"],
      why: "2018 年初无法知道 2019–2024 年的数据。walk-forward 的关键是按时间推进，每次只用当时已知的数据拟合，再评估随后一段，而不是仅仅定期重新拟合。",
    },
    en: {
      stem: "Which change restores the time constraint of walk-forward testing?",
      options: ["Include more future years in each fit to stabilize parameters.", "Refit monthly but keep using the full dataset.", "Shuffle the full dataset before simulating each year's trades.", "Fit only on data already available before each trading period."],
      why: "At the start of 2018, data from 2019-2024 was unavailable. Walk-forward testing advances through time: fit on information available then, and evaluate on the following period. Periodic refitting alone is not enough.",
    },
  }),
  overfitting: bilingual({
    claim: "We tried 2,000 parameter sets on the same ten years and report only the winner: 41% a year. This proves a persistent edge.",
    answer: 0,
    zh: {
      stem: "这段结论缺少的关键证据是什么？",
      options: ["未参与挑选参数的数据上的表现。", "同一段数据里排名第二的参数收益更低。", "把 2,000 组参数扩到 4,000 组后，冠军收益更高。", "冠军参数在相同数据上重复运行，仍得到 41%。"],
      why: "从大量尝试中选出最好的一组，会产生选择偏差，可能把噪声当成规律。反复运行同一组数据不构成新证据；需要样本外检验，并考虑搜索次数带来的偏差。",
    },
    en: {
      stem: "What key evidence is missing from this conclusion?",
      options: ["Performance on data not used to select the parameters.", "A lower return for the runner-up on the same data.", "A higher winning return after expanding the search to 4,000 sets.", "The same 41% when the winning parameters are rerun on identical data."],
      why: "Selecting the best of many attempts creates selection bias and can mistake noise for a pattern. Rerunning the same data adds no independent evidence. Test on unseen data and account for the search process.",
    },
  }),
  "look-ahead bias": bilingual({
    claim: "Our Tuesday trades use inventory figures first published on Wednesday. The backtest earns 25% a year.",
    answer: 2,
    zh: {
      stem: "即使不考虑交易成本，回测仍有什么关键错误？",
      options: ["每周公布的数据不能用于任何交易策略。", "年化收益超过 20% 的回测一律无效。", "周二决策使用了周三才公开的信息。", "周二交易天然会产生幸存者偏差。"],
      why: "first published on Wednesday 限定了信息最早可用的时间。用它交易周二构成 look-ahead bias。必须按真实发布时间对齐信号与交易；改成月度数据也不能自动修复。",
    },
    en: {
      stem: "What critical error remains even before trading costs are considered?",
      options: ["Weekly releases cannot be used in any trading strategy.", "Every backtest above 20% annual return is invalid.", "Tuesday's decisions use information first made public on Wednesday.", "Trading on Tuesdays inherently creates survivorship bias."],
      why: "First published on Wednesday fixes the earliest availability time. Using it on Tuesday is look-ahead bias. Align signals with actual release times; switching to monthly data does not automatically fix it.",
    },
  }),
  "survivorship bias": bilingual({
    claim: "Funds still operating today returned 9% a year over the last decade. We excluded funds that closed, so 9% represents the whole industry.",
    answer: 1,
    zh: {
      stem: "要检验行业整体回报，应怎样补样本？",
      options: ["只增加目前规模最大的存续基金。", "纳入期间关闭基金的历史收益，尽量还原当时的完整样本。", "保留原名单，只把观察期缩短为一年。", "把原名单中收益为负的年份删除。"],
      why: "still operating today 把今天是否存续当作入选条件。被排除的基金可能表现更差，行业估计因此可能偏高；应纳入关闭基金，而不是只扩充幸存者名单。",
    },
    en: {
      stem: "How should the sample be repaired to assess industry returns?",
      options: ["Add only the largest funds that still operate.", "Include historical returns of funds that closed during the period.", "Keep the same list but shorten the window to one year.", "Remove negative-return years from the current list."],
      why: "Still operating today conditions inclusion on survival. Excluded funds may have performed worse, biasing the estimate upward. Restore the historical population, including closed funds, rather than adding more survivors.",
    },
  }),
  "data snooping": bilingual({
    claim: "We tested 100 ineffective factors, each with a correctly sized 5% significance test. Finding five significant results would establish five real effects.",
    answer: 3,
    zh: {
      stem: "在全部因子实际无效的假设下，假阳性数量的期望是多少？",
      options: ["0 个，因为真正无效就不可能显著。", "1 个，因为每次只能检验一个假设。", "95 个，因为置信度是 95%。", "5 个，但不是每次实验都恰好有 5 个。"],
      why: "100 × 5% = 5，是假阳性数量的期望，不是一次实验的固定结果。看到 5 个显著结果不能据此证明有效；需要考虑多重检验与独立验证。期望相加不要求各次检验独立。",
    },
    en: {
      stem: "If every factor is ineffective, what is the expected number of false positives?",
      options: ["Zero: an ineffective factor cannot be significant.", "One: only one hypothesis can be tested at a time.", "Ninety-five: the confidence level is 95%.", "Five, but not exactly five in every experiment."],
      why: "100 times 5% gives an expectation of five false positives, not a fixed count. Five significant results do not establish five real effects. Consider multiple testing and independent validation; adding expectations does not require independent tests.",
    },
  }),
  "sharpe ratio": bilingual({
    claim: "Annual mean return is 10%, the risk-free rate is 2%, and annual return volatility is 8%. We report a Sharpe ratio of 1.25.",
    answer: 1,
    zh: {
      stem: "按题中给定的年化口径，夏普比应是多少？",
      options: ["1.25", "1.00", "0.80", "1.50"],
      why: "Sharpe ratio 的分子是相对无风险利率的超额收益：(10% − 2%) ÷ 8% = 1。1.25 来自 10% ÷ 8%，漏减了无风险利率。这里收益与波动率均已按年给出，无需再次年化。",
    },
    en: {
      stem: "Using the stated annual figures, what should the Sharpe ratio be?",
      options: ["1.25", "1.00", "0.80", "1.50"],
      why: "Sharpe uses return above the risk-free rate: (10% minus 2%) divided by 8% equals 1. The reported 1.25 omits the risk-free deduction. Both inputs are already annual, so no further annualization is needed.",
    },
  }),
  "max drawdown": bilingual({
    claim: "The fund's only observed NAV path is 100, 120, 90, 108, with no cash flows. Since it finishes above 100, its maximum drawdown is zero.",
    answer: 2,
    zh: {
      stem: "根据这条净值路径，最大回撤是多少？",
      options: ["0%，因为最终净值高于起点。", "10%，因为最低净值比起点低 10%。", "25%，因为从 120 的峰值跌到了 90。", "30%，因为净值从峰值少了 30。"],
      why: "max drawdown 按峰值到随后谷值的比例算：(120 − 90) ÷ 120 = 25%。30 是净值点数，不能直接写成 30%；最终回升不抹掉曾经发生的回撤。",
    },
    en: {
      stem: "What is the maximum drawdown on this NAV path?",
      options: ["0%: the final NAV is above the starting value.", "10%: the lowest NAV is 10% below the start.", "25%: NAV falls from the peak of 120 to 90.", "30%: NAV loses 30 points from its peak."],
      why: "Maximum drawdown is the proportional peak-to-later-trough fall: (120 minus 90) divided by 120 equals 25%. Thirty NAV points are not 30%. A later recovery does not erase the drawdown.",
    },
  }),
  "hit rate": bilingual({
    claim: "With equal stakes, 80% of trades win $1 and 20% lose $6, before costs. The 80% hit rate proves positive expectancy.",
    answer: 0,
    zh: {
      stem: "按给定胜率和盈亏金额，每笔交易的期望盈亏是多少？",
      options: ["−$0.40", "+$0.80", "+$0.40", "−$1.20"],
      why: "expectancy = 80% × $1 − 20% × $6 = −$0.40。hit rate 只数赢了多少次，不反映每次赚亏的金额；这组假设下，未扣成本的期望已经为负。",
    },
    en: {
      stem: "What is expected profit or loss per trade under these assumptions?",
      options: ["−$0.40", "+$0.80", "+$0.40", "−$1.20"],
      why: "Expectancy is 80% times $1 minus 20% times $6, or minus $0.40. Hit rate counts wins but ignores their size relative to losses. Under these assumptions expectancy is negative even before costs.",
    },
  }),
  alpha: bilingual({
    claim: "The fund returned 12% while the market returned 10%. Without adjusting for beta or other risk exposures, we call the 2-point gap alpha.",
    answer: 3,
    zh: {
      stem: "目前的数据最能支持哪种表述？",
      options: ["已经确认有 2 个百分点的风险调整后收益。", "收益高于市场意味着 beta 一定小于 1。", "只需改用更低的基准，alpha 就更可信。", "原始收益领先 2 个百分点，尚未证明风险调整后的 alpha。"],
      why: "12% − 10% 是原始收益差。alpha 需要相对明确的风险模型或基准进行调整；更高的 beta 等风险暴露也可能解释这段差额，不能仅凭领先就认定为选股能力。",
    },
    en: {
      stem: "Which wording is best supported by the information provided?",
      options: ["Risk-adjusted alpha of two percentage points is established.", "Beating the market means beta must be below one.", "Choosing a lower-return benchmark would make alpha more credible.", "Raw return led by two points; risk-adjusted alpha is not yet established."],
      why: "12% minus 10% is a raw return gap. Alpha requires adjustment under a specified risk model or benchmark. Higher beta or other exposures may explain the gap; beating the market alone does not establish skill.",
    },
  }),
  rebalance: bilingual({
    claim: "Our 50/50 portfolio drifts to 70% stocks and 30% bonds. Rebalancing to 50/50 requires buying more stocks.",
    answer: 1,
    zh: {
      stem: "假设没有资金进出，恢复目标权重应怎样操作？",
      options: ["买股票、卖债券，进一步提高股票权重。", "卖股票、买债券，恢复 50/50。", "股票和债券都不动，当前权重就是目标权重。", "把目标改成 70/30，再称为已恢复原目标。"],
      why: "rebalance 是把实际权重调回目标。股票已超配，应卖出股票并买入债券。仅修改目标不等于恢复原来的配置；再平衡也不是对下一段涨跌的预测。",
    },
    en: {
      stem: "With no cash entering or leaving, which trade restores the target weights?",
      options: ["Buy stocks and sell bonds, increasing the stock weight further.", "Sell stocks and buy bonds to restore 50/50.", "Trade neither asset: the current weights are already the target.", "Rename the target 70/30 and call the original allocation restored."],
      why: "Rebalancing restores target weights. Stocks are overweight, so sell stocks and buy bonds. Changing the target does not restore the original allocation, and rebalancing is not a forecast of the next price move.",
    },
  }),
  "position sizing": bilingual({
    claim: "We put 10% of capital in each of ten positions. Their volatilities differ greatly, but equal cash weights guarantee equal risk contributions.",
    answer: 0,
    zh: {
      stem: "这个仓位结论忽略了什么？",
      options: ["风险贡献还取决于波动率及持仓之间的相关性。", "每个仓位只占 10%，因此各仓位造成的亏损都相同。", "等权配置可以自动消除共同因子带来的集中风险。", "只要历史收益率相同，各持仓的风险贡献就相同。"],
      why: "position sizing 给出资金如何分配；exposure 与风险贡献还受各资产波动率和协方差影响。等资金权重不能自动推出等风险贡献。",
    },
    en: {
      stem: "What does the sizing conclusion overlook?",
      options: ["Risk contributions also depend on volatility and correlations.", "A 10% weight means each position must produce the same loss.", "Equal weights automatically remove concentration in common factors.", "Matching historical returns imply matching risk contributions."],
      why: "Position sizing sets the cash allocation. Exposures and risk contributions also depend on asset volatilities and covariances. Equal cash weights do not automatically produce equal risk contributions.",
    },
  }),
  correlation: bilingual({
    claim: "We hold ten energy contracts with pairwise return correlations near 0.95. Ten holdings mean the portfolio is well diversified.",
    answer: 2,
    zh: {
      stem: "哪项判断最符合这段数据？",
      options: ["只要持仓名称不同，就能获得充分分散。", "相关性为 0.95，意味着每个合约上涨概率为 95%。", "持仓数量多，但高度同涨同跌，分散作用可能有限。", "相关性高说明这些合约之间一定有因果关系。"],
      why: "correlation 衡量共同变动，不是上涨概率，也不证明因果。接近 1 的相关性意味着这些持仓可能承受相似冲击，不能只数合约个数就宣布充分分散。",
    },
    en: {
      stem: "Which interpretation best fits the data?",
      options: ["Different contract names ensure adequate diversification.", "A correlation of 0.95 means each contract has a 95% chance of rising.", "There are many holdings, but close co-movement may limit diversification.", "High correlation proves one contract causes another to move."],
      why: "Correlation measures co-movement, not the probability of gains or causation. Correlations near one suggest similar shocks may hit the holdings together. Counting contract names is not enough to establish diversification.",
    },
  }),
  exposure: bilingual({
    claim: "The portfolio is long 100% of NAV in one stock basket and short 100% in another. Net exposure is zero, so there is no market or funding risk.",
    answer: 3,
    zh: {
      stem: "零净敞口为什么不足以支持这项结论？",
      options: ["零净敞口说明总敞口也必然为零。", "多空金额相等就能保证两个篮子的涨跌完全抵消。", "只要是空头，就不会产生融资或借券成本。", "总敞口仍为 200%，且多空风险可能不匹配。"],
      why: "net exposure = 100% − 100% = 0；gross exposure = 100% + 100% = 200%。金额相抵不表示 beta、行业等风险逐项相抵，也不消除借券、融资或被迫平仓的风险。",
    },
    en: {
      stem: "Why does zero net exposure not support this conclusion?",
      options: ["Zero net exposure necessarily means zero gross exposure.", "Equal long and short amounts guarantee offsetting returns.", "Short positions cannot incur borrowing or financing costs.", "Gross exposure is still 200%, and the long and short risks may not match."],
      why: "Net exposure is 100% minus 100%, or zero. Gross exposure is their sum, 200%. Equal amounts do not ensure offsetting beta or sector risks, nor remove borrowing, financing or forced-liquidation risk.",
    },
  }),
  "transaction cost": bilingual({
    claim: "A single round trip earns 12 basis points before costs. Entry costs 4 basis points and exit costs 4 basis points. We report 8 basis points net.",
    answer: 0,
    zh: {
      stem: "没有其他成本时，这次往返交易的净收益是多少？",
      options: ["4 个基点", "8 个基点", "12 个基点", "−4 个基点"],
      why: "round trip 包含买入和卖出两边：12 − 4 − 4 = 4 个基点。8 个基点只扣了一边成本。1 个基点是 0.01 个百分点，题中全部按同一笔交易的名义金额计算。",
    },
    en: {
      stem: "With no other costs, what is the net return on this round trip?",
      options: ["4 basis points", "8 basis points", "12 basis points", "−4 basis points"],
      why: "A round trip has two sides: 12 minus 4 minus 4 equals 4 basis points. Eight deducts only one side. One basis point is 0.01 percentage point; all figures here use the same trade notional.",
    },
  }),
  slippage: bilingual({
    claim: "A buy signal occurs at $100, but the order fills at $100.30. The backtest books the buy at $100 because commissions are already included.",
    answer: 2,
    zh: {
      stem: "相对信号价，这笔买入遗漏了多少不利滑点？",
      options: ["0，因为佣金已计入。", "3 个基点，因为价格差是 $0.30。", "30 个基点，因为 $0.30 ÷ $100 = 0.30%。", "300 个基点，因为成交价超过了 $100。"],
      why: "买入成交价高于信号价，差额 $0.30 ÷ $100 = 0.003 = 0.30% = 30 个基点。佣金与这段成交价偏离是不同成本；计入佣金不能代替计入滑点。",
    },
    en: {
      stem: "How much adverse buy slippage relative to the signal price is omitted?",
      options: ["Zero, because commission is already included.", "3 basis points, because the price gap is $0.30.", "30 basis points: $0.30 divided by $100 is 0.30%.", "300 basis points, because the fill is above $100."],
      why: "The buy fills above the signal price: $0.30 divided by $100 is 0.003, or 0.30%, which is 30 basis points. Commission and execution-price slippage are different costs; including one does not include the other.",
    },
  }),
  "capacity constraint": bilingual({
    claim: "The strategy earned 8% net at $10 million. We forecast the same percentage return at $1 billion, assuming unchanged market impact.",
    answer: 1,
    zh: {
      stem: "扩规模前最需要检验哪项假设？",
      options: ["只延长小规模回测区间，能否确认大规模实盘收益。", "更大订单的冲击与成交约束是否会侵蚀净收益。", "只把订单拆小，是否就能保证成交成本完全不变。", "只保持各标的资金比例，是否就能维持原来的冲击成本。"],
      why: "capacity constraint 关注策略能承载多少资金。资产规模扩大一百倍，订单规模和市场冲击可能随之变化；小规模净收益不能按相同比例无条件外推。",
    },
    en: {
      stem: "Which assumption most needs testing before scaling?",
      options: ["Whether a longer small-scale backtest alone establishes large-scale live returns.", "Whether larger orders and execution limits would erode net returns.", "Whether splitting orders alone guarantees unchanged execution costs.", "Whether unchanged portfolio weights alone preserve market impact costs."],
      why: "Capacity concerns how much capital a strategy can absorb. A hundredfold increase can change order sizes and market impact. The small-scale percentage return cannot be extrapolated without checking these effects.",
    },
  }),
  "liquidity constraint": bilingual({
    claim: "The market trades $2 million per day. Our execution rule caps orders at 10% of daily volume, yet the plan buys $1 million in one day.",
    answer: 3,
    zh: {
      stem: "假设日成交额保持不变，按这条规则至少需要几个交易日？",
      options: ["1 天", "2 天", "10 天", "5 天"],
      why: "每天最多买入 $2 million × 10% = $0.2 million；$1 million ÷ $0.2 million = 5 天。这只是给定规则下的下限，不保证每天都能以预期价格成交。",
    },
    en: {
      stem: "If daily volume stays unchanged, what is the minimum number of trading days under this rule?",
      options: ["1 day", "2 days", "10 days", "5 days"],
      why: "The cap allows $2 million times 10%, or $0.2 million a day. $1 million divided by $0.2 million requires five days. This is a rule-based minimum, not a guarantee of fills at the expected price.",
    },
  }),
  "stress test": bilingual({
    claim: "The portfolio survives a replay of the 2020 oil crash. We conclude that every future crisis is covered.",
    answer: 2,
    zh: {
      stem: "哪项结论仍在证据范围内？",
      options: ["以后任何危机都不会造成更大亏损。", "通过一个历史情景，就能省略流动性冲击测试。", "在设定的冲击与模型假设下，通过了这一次压力测试。", "历史危机已经发生过，所以重演结果没有任何参考价值。"],
      why: "stress test 检验的是指定情景下的表现。通过某次历史冲击有参考价值，但不能覆盖所有未来路径；新的相关性变化、流动性冲击或融资条件仍可能带来不同结果。",
    },
    en: {
      stem: "Which conclusion stays within the evidence?",
      options: ["No future crisis can cause a larger loss.", "Passing one historical replay removes the need for liquidity tests.", "The portfolio passed this specified stress test under its model assumptions.", "Replaying an event that already happened provides no useful information."],
      why: "A stress test evaluates a specified scenario. Passing a historical replay is informative but does not cover every future path. Changes in correlations, liquidity or funding can produce different outcomes.",
    },
  }),
  "scenario analysis": bilingual({
    claim: "We model three scenarios with returns of +12%, +4%, and −8%. No probabilities are assigned. The expected return is therefore 2.67%.",
    answer: 0,
    zh: {
      stem: "把三种情景的平均值称为期望收益，缺少什么？",
      options: ["各情景的概率，以及对情景覆盖范围的说明。", "只需把负收益情景删掉，就能得到期望。", "只需把三个收益加起来，不必除以三。", "情景数量只要超过两个，就自动等概率。"],
      why: "(12% + 4% − 8%) ÷ 3 ≈ 2.67% 是等权情景平均值。期望需要概率权重；如果情景也没有覆盖全部可能结果，更不能把这个平均值直接称为整体期望收益。",
    },
    en: {
      stem: "What is missing when this scenario average is called an expected return?",
      options: ["Scenario probabilities and an account of which outcomes the scenarios cover.", "Simply remove the negative scenario to obtain an expectation.", "Simply add the three returns without dividing by three.", "Having more than two scenarios automatically makes them equally likely."],
      why: "(12% plus 4% minus 8%) divided by three is about 2.67%, an equal-weight scenario average. An expectation requires probability weights. Scenarios that omit possible outcomes also cannot directly establish the overall expected return.",
    },
  }),
  "value at risk": bilingual({
    claim: "The model estimates one-day 95% VaR at 2.1% of NAV. Therefore, a daily loss greater than 2.1% is impossible.",
    answer: 1,
    zh: {
      stem: "哪种读法才符合这个 VaR 指标？",
      options: ["2.1% 是任何情况下的最大日亏损。", "在模型假设下约 5% 的日子会超过该损失阈值，尾部损失大小未给出。", "未来每 20 个交易日必定有且只有一天亏损 2.1%。", "95% 表示未来有 95% 的概率盈利。"],
      why: "95% VaR 是损失分布的分位数估计，不是亏损硬上限，也不规定超限日的固定时间表。它没有说明超过 2.1% 后会亏多少；实际超限频率也可能因模型失准而不同。",
    },
    en: {
      stem: "Which reading matches this VaR estimate?",
      options: ["2.1% is the largest possible daily loss under all conditions.", "Under the model, about 5% of days exceed the threshold; tail-loss size is unspecified.", "Exactly one day in every future block of twenty must lose exactly 2.1%.", "95% means a 95% probability of making a profit."],
      why: "95% VaR estimates a loss quantile, not a hard loss cap or a fixed schedule of exceptions. It does not say how large losses beyond 2.1% can be. Actual exception rates can also differ if the model is inaccurate.",
    },
  }),
  robustness: bilingual({
    claim: "The signal is profitable with a 12-month lookback, but loses money at 11 and 13 months. We describe the result as robust.",
    answer: 3,
    zh: {
      stem: "哪项评价最符合这些结果？",
      options: ["12 个月盈利就足以说明稳健。", "只要不披露 11 和 13 个月，稳健性就不受影响。", "参数有波动就能证明这三个结果都来自随机数。", "结果对邻近参数敏感，现有证据不足以支持稳健。"],
      why: "robustness 看的是合理改变参数或样本后，结论是否仍成立。只有一个窄参数点盈利、相邻点亏损，是需要继续调查的脆弱性信号；它既不能证明稳健，也不能单独证明策略必然无效。",
    },
    en: {
      stem: "Which assessment best fits these results?",
      options: ["Profitability at twelve months is enough to establish robustness.", "Omitting the eleven- and thirteen-month results preserves robustness.", "Parameter variation proves all three results came from random numbers.", "Nearby settings change the result; robustness is not established."],
      why: "Robustness asks whether a conclusion survives reasonable changes in parameters or samples. Profit at one narrow setting with losses nearby signals fragility worth investigating. It neither establishes robustness nor proves the strategy must be useless.",
    },
  }),
};

// Two fresh cases lead each review. termIds may include earlier units, but
// never a later unit: a review must consolidate concepts already introduced.
export const AUDIT_REVIEWS = [
  {
    id: "audit-benchmark-match",
    unit: 1,
    termIds: ["benchmark", "backtest"],
    ...bilingual({
      claim: "An equity strategy reports total returns including dividends. Its benchmark uses the same index's price return, excluding dividends. The gap is called added value.",
      answer: 2,
      zh: {
        stem: "要公平比较，应先修正哪项口径？",
        options: ["把策略收益也改成不含股息，然后继续称为总收益。", "挑一个收益更低的指数，把差额放大。", "使用同期间、同含息口径的基准，明确成本处理。", "只比较表现最好的一年，避免股息的影响。"],
        why: "策略的 total return 包含股息，基准的 price return 不包含；差额可能只是口径差异。先统一期间与股息处理，再说明费用口径，才能讨论策略是否创造了额外价值。",
      },
      en: {
        stem: "Which measurement issue should be fixed first for a fair comparison?",
        options: ["Exclude dividends from the strategy but keep calling it total return.", "Choose a lower-return index to widen the gap.", "Use a benchmark with matching dates and dividend treatment, and clarify costs.", "Compare only the best year to avoid the effect of dividends."],
        why: "The strategy includes dividends while the price-return benchmark excludes them. The gap may reflect mismatched measures. Match dates and dividend treatment and state cost assumptions before discussing added value.",
      },
    }),
  },
  {
    id: "audit-test-design",
    unit: 1,
    termIds: ["walk-forward", "in-sample", "out-of-sample"],
    ...bilingual({
      claim: "We need a historical test that refits annually while respecting what was known at each decision date. Which design should we use?",
      answer: 1,
      zh: {
        stem: "哪套流程最符合要求？",
        options: ["用全部历史选定参数，再把每一年都称为样本外。", "每年仅用此前已知的数据拟合，固定规则交易随后一年，并汇总结果。", "每年结束后用该年的收益挑参数，再回填该年的交易。", "随机打乱年份，把未来年份分进每次训练集。"],
        why: "walk-forward 的时间顺序是先用过去拟合，再检验随后一段。每段测试结果可以汇总，但不能用同段收益倒推当时的参数；这个流程也不保证未来一定盈利。",
      },
      en: {
        stem: "Which procedure best meets the requirement?",
        options: ["Choose parameters on all history and label each year out-of-sample.", "Fit on data available before each year, trade that year under fixed rules, then combine results.", "Use each year's returns to choose parameters and backfill that year's trades.", "Shuffle years so future years enter every training set."],
        why: "Walk-forward testing fits on the past before evaluating the next period. Combine those test results without using a period's own returns to retroactively select its parameters. This design still does not guarantee future profits.",
      },
    }),
  },
  {
    id: "audit-familywise-error",
    unit: 2,
    termIds: ["multiple testing", "data snooping"],
    ...bilingual({
      claim: "We run 20 independent tests. All null hypotheses are true and each test has a 5% false-positive rate. The chance of at least one false positive is still only 5%.",
      answer: 3,
      zh: {
        stem: "在这些明确假设下，至少出现一个假阳性的概率约是多少？",
        options: ["5%", "100%", "约 36%", "约 64%"],
        why: "20 次全部不误报的概率是 0.95²⁰ ≈ 35.85%，因此至少一次误报为 1 − 0.95²⁰ ≈ 64.15%。100% 是把概率直接相加的错误；这里的乘法依赖题中独立的假设。",
      },
      en: {
        stem: "Under these explicit assumptions, what is the approximate probability of at least one false positive?",
        options: ["5%", "100%", "About 36%", "About 64%"],
        why: "The probability of no false positives is 0.95 to the twentieth power, about 35.85%. Its complement is about 64.15%. Adding the rates to get 100% is incorrect; the product here relies on the stated independence assumption.",
      },
    }),
  },
  {
    id: "audit-repair-two-biases",
    unit: 2,
    termIds: ["look-ahead bias", "survivorship bias"],
    ...bilingual({
      claim: "A 2018 backtest selects stocks from today's surviving-company list and uses earnings data before their publication dates. We fix it by adding commissions.",
      answer: 0,
      zh: {
        stem: "哪项修复直接针对题中两种偏差？",
        options: ["还原各时点的标的池，纳入后来退市的公司，并按真实公布时间使用财报。", "保留当前标的池，只把佣金估计翻倍。", "保留财报时间错位，只增加股票数量。", "删除表现最差的股票，让回测更接近当前存续公司。"],
        why: "今天的存续名单遗漏后来退市的公司，是幸存者偏差；提前使用财报是未来函数。交易成本是另一项问题，补上佣金不能修复样本和信息时点错误。",
      },
      en: {
        stem: "Which repair directly addresses both biases in the excerpt?",
        options: ["Restore historical universes including later delistings, and use earnings only after publication.", "Keep today's universe and double the commission estimate.", "Keep the early earnings timestamps but add more stocks.", "Delete the worst stocks to match today's surviving companies more closely."],
        why: "Today's survivor list omits companies that later delisted: survivorship bias. Using earnings before publication is look-ahead bias. Commissions are a separate issue and cannot repair either the sample or information timing.",
      },
    }),
  },
  {
    id: "audit-beta-adjustment",
    unit: 3,
    termIds: ["beta", "alpha"],
    ...bilingual({
      claim: "Assume a single-factor model: the risk-free rate is 2%, market excess return is 5%, and fund beta is 1.4. The fund returns 9%, which is presented as positive alpha.",
      answer: 1,
      zh: {
        stem: "按题中给定模型，这期的 alpha 是多少？",
        options: ["2 个百分点", "0 个百分点", "7 个百分点", "−2 个百分点"],
        why: "模型对应的收益是 2% + 1.4 × 5% = 9%；实际也是 9%，残差 alpha 为 0。这里的市场超额收益已经减去无风险利率，不应再减一次。结论只针对给定模型和这期数据。",
      },
      en: {
        stem: "Under the specified model, what is alpha for this period?",
        options: ["2 percentage points", "0 percentage points", "7 percentage points", "−2 percentage points"],
        why: "The model implies 2% plus 1.4 times 5%, or 9%. Actual return is also 9%, leaving zero alpha. Market excess return already deducts the risk-free rate. This conclusion applies to this model and period.",
      },
    }),
  },
  {
    id: "audit-positive-expectancy",
    unit: 3,
    termIds: ["expectancy", "hit rate"],
    ...bilingual({
      claim: "Under a fixed equal-stake payoff model, 40% of trades win $3 and 60% lose $1, before costs. A hit rate below 50% means the strategy must lose money on average.",
      answer: 2,
      zh: {
        stem: "哪项结论符合给定的概率与盈亏金额？",
        options: ["胜率不足 50%，每笔期望必然为负。", "每笔期望是 $2，因为 $3 − $1 = $2。", "未扣成本的每笔期望是 +$0.60，但不保证每段实盘都盈利。", "每笔期望是 −$0.20，因为 40% − 60% = −20%。"],
        why: "expectancy = 40% × $3 − 60% × $1 = +$0.60。胜率低也可以有正期望，但交易成本可能侵蚀它；给定模型下的期望也不是每一段实际结果的保证。",
      },
      en: {
        stem: "Which conclusion follows from the stated probabilities and payoffs?",
        options: ["A hit rate below 50% necessarily makes expectancy negative.", "Expectancy is $2 because $3 minus $1 equals $2.", "Expectancy is +$0.60 before costs, without guaranteeing profit in every live period.", "Expectancy is minus $0.20 because 40% minus 60% equals minus 20%."],
        why: "Expectancy is 40% times $3 minus 60% times $1, or plus $0.60. A low hit rate can coexist with positive expectancy. Costs can erode it, and model expectancy does not guarantee every realized period will be profitable.",
      },
    }),
  },
  {
    id: "audit-net-vs-gross",
    unit: 4,
    termIds: ["exposure", "position sizing"],
    ...bilingual({
      claim: "A fund has long positions worth 80% of NAV and short positions worth 50%. The report calls 30% its gross exposure.",
      answer: 3,
      zh: {
        stem: "净敞口与总敞口应分别是多少？",
        options: ["净敞口 130%，总敞口 30%。", "净敞口 30%，总敞口 80%。", "净敞口 50%，总敞口 130%。", "净敞口 30%，总敞口 130%。"],
        why: "净敞口 net exposure 按多头减空头：80% − 50% = 30%；总敞口 gross exposure 按两侧绝对值相加：80% + 50% = 130%。它们描述不同维度，都不能单独完整衡量风险。",
      },
      en: {
        stem: "What are net exposure and gross exposure, respectively?",
        options: ["Net 130%; gross 30%.", "Net 30%; gross 80%.", "Net 50%; gross 130%.", "Net 30%; gross 130%."],
        why: "Net exposure subtracts short from long: 80% minus 50% equals 30%. Gross exposure sums their absolute sizes: 80% plus 50% equals 130%. They describe different dimensions and neither alone fully measures risk.",
      },
    }),
  },
  {
    id: "audit-turnover-definition",
    unit: 4,
    termIds: ["turnover", "rebalance"],
    ...bilingual({
      claim: "At one rebalance, a $1 million portfolio buys $100,000 and sells $100,000. We define one-way turnover as (buys + sells) / (2 × NAV), then report 20% one-way turnover.",
      answer: 0,
      zh: {
        stem: "按题中明确给出的定义，单边换手率是多少？",
        options: ["10%", "20%", "0%", "40%"],
        why: "($100,000 + $100,000) ÷ (2 × $1,000,000) = 10%。20% 是买卖金额之和除以 NAV 的双边口径；不同报告可能采用不同定义，先看公式，不能只看 turnover 这个词。",
      },
      en: {
        stem: "Using the definition explicitly given, what is one-way turnover?",
        options: ["10%", "20%", "0%", "40%"],
        why: "($100,000 plus $100,000) divided by (2 times $1 million) equals 10%. Twenty percent uses both traded sides without the factor of two. Turnover conventions vary, so read the stated formula before comparing reports.",
      },
    }),
  },
  {
    id: "audit-net-edge",
    unit: 5,
    termIds: ["transaction cost", "slippage"],
    ...bilingual({
      claim: "Gross return is 6% a year. Annual fees and spreads cost 1 percentage point; slippage costs another 2 points. All costs use the same capital base and do not overlap. We report 5% net.",
      answer: 2,
      zh: {
        stem: "按题中可直接相减的成本口径，年净收益是多少？",
        options: ["5%", "4%", "3%", "6%"],
        why: "费用与价差占 1 个百分点，另有不重叠的滑点 2 个百分点，所以净收益为 6% − 1% − 2% = 3%。只扣显性费用会漏掉滑点；这里已经说明成本基数相同、没有重复计入。",
      },
      en: {
        stem: "Under the stated additive cost convention, what is annual net return?",
        options: ["5%", "4%", "3%", "6%"],
        why: "Fees and spreads cost one point, and non-overlapping slippage another two. Net return is 6% minus 1% minus 2%, or 3%. Deducting only explicit costs omits slippage; the excerpt specifies matching bases and no overlap.",
      },
    }),
  },
  {
    id: "audit-capacity-gate",
    unit: 5,
    termIds: ["capacity constraint", "liquidity constraint", "slippage"],
    ...bilingual({
      claim: "A strategy needs to deploy $5 million each day. The relevant market trades $20 million daily, and the strategy caps participation at 10%. It claims the planned size fits the rule.",
      answer: 1,
      zh: {
        stem: "在成交额不变的假设下，最直接的规模约束是什么？",
        options: ["$5 million 小于整个市场的成交额，因此符合规则。", "参与率上限只允许每天 $2 million，低于计划所需的 $5 million。", "市场日成交额就是策略每天可以无冲击交易的金额。", "把指令拆成更多小单，就能在同一天绕过总参与率上限。"],
        why: "$20 million × 10% = $2 million，是给定规则下的日上限。拆单不会改变当天累计参与率；若不改执行周期或市场范围，这个流动性约束会限制策略容量。",
      },
      en: {
        stem: "With market volume unchanged, what is the immediate size constraint?",
        options: ["$5 million is below total market volume, so the rule is met.", "The participation cap permits $2 million a day, below the required $5 million.", "Daily market volume is the amount the strategy can trade without impact.", "Splitting orders bypasses the aggregate daily participation cap."],
        why: "$20 million times 10% permits $2 million per day under the rule. Splitting orders does not change aggregate participation. Without changing execution timing or market coverage, this liquidity limit constrains strategy capacity.",
      },
    }),
  },
  {
    id: "audit-var-exceedances",
    unit: 6,
    termIds: ["value at risk", "stress test"],
    ...bilingual({
      claim: "A correctly calibrated continuous-loss model estimates one-day 95% VaR. Over 250 trading days, no losses should exceed VaR because it is a risk limit.",
      answer: 0,
      zh: {
        stem: "按题中的模型假设，预期约有多少天超过 VaR 阈值？",
        options: ["12.5 天；这是期望值，不是必须出现的天数。", "0 天；VaR 是无法突破的硬上限。", "237.5 天；95% 的日子都会超限。", "5 天；95% 的置信水平就对应 5 天。"],
        why: "250 × (1 − 95%) = 12.5，是超限天数的期望，不要求实际出现半天，也不是固定日程。VaR 是分位数估计；超限并不自动代表模型出错，仍需结合频率、聚集性与尾部压力测试评估。",
      },
      en: {
        stem: "Under the stated model assumptions, about how many VaR exceedance days are expected?",
        options: ["12.5 days: an expectation, not a required realized count.", "Zero days: VaR is a hard ceiling that cannot be breached.", "237.5 days: 95% of days must exceed the threshold.", "Five days: 95% confidence directly means five days."],
        why: "250 times (1 minus 95%) gives 12.5 expected exceedance days, not a fixed schedule or a realized half-day. VaR is a quantile estimate. Exceptions alone do not establish model failure; assess frequency, clustering and tail stress too.",
      },
    }),
  },
  {
    id: "audit-cost-sensitivity",
    unit: 6,
    termIds: ["sensitivity", "robustness", "scenario analysis"],
    ...bilingual({
      claim: "Annual net return is +4% at 5 basis points of slippage per trade, +1% at 10, and −2% at 15, with everything else fixed. Only the 5-basis-point case is highlighted as robust.",
      answer: 3,
      zh: {
        stem: "在评价稳健性之前，最应该做什么？",
        options: ["只保留 5 个基点的假设，因为它的结果最好。", "把三个结果直接等权平均，就证明未来收益为正。", "换成月度收益展示，让负值看起来更小。", "核查可实现的成交成本范围，并如实报告结论在哪些假设下转负。"],
        why: "sensitivity 分析显示结论会随滑点假设变号。先核查真实执行成本是否落在这些范围内，再判断 robustness；只报最乐观的情景会隐藏策略对成本的依赖。",
      },
      en: {
        stem: "What should be done before judging robustness?",
        options: ["Keep only the five-basis-point assumption because it gives the best result.", "Average the three cases equally to prove future returns will be positive.", "Display monthly returns so the negative number looks smaller.", "Check realistic execution costs and disclose the assumptions under which returns turn negative."],
        why: "The sensitivity analysis shows that changing slippage reverses the sign. Check which execution costs are realistic before judging robustness. Highlighting only the optimistic scenario hides the strategy's dependence on the cost assumption.",
      },
    }),
  },
];
