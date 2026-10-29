// 中文对照只保留术语译名；释义、例句、混淆说明都在课程包里原生中文
// （content/packs/hedge-or-pledge/zh-CN/course.json）。
export const termLocalization: Record<string, { termZh: string }> = {
  hedge: { termZh: "对冲" },
  pledge: { termZh: "抵押／质押" },
  collateral: { termZh: "抵押品" },
  haircut: { termZh: "折扣率" },
  margin: { termZh: "保证金" },
  "margin call": { termZh: "追缴保证金" },
  leverage: { termZh: "杠杆" },
  derivative: { termZh: "衍生品" },
  option: { termZh: "期权" },
  put: { termZh: "看跌期权" },
  call: { termZh: "看涨期权" },
  "short selling": { termZh: "卖空" },
  liquidity: { termZh: "流动性" },
  notional: { termZh: "名义金额" },
  premium: { termZh: "权利金" },
  yield: { termZh: "收益率" },
  duration: { termZh: "久期" },
  "basis risk": { termZh: "基差风险" },
  long: { termZh: "做多" },
  volatility: { termZh: "波动率" },
  diversification: { termZh: "分散化" },
  counterparty: { termZh: "交易对手方" },
  default: { termZh: "违约" },
  "mark-to-market": { termZh: "盯市" },
  "securities-backed loan": { termZh: "证券质押贷款" },
  "capital gains": { termZh: "资本利得" },
  "buy-borrow-die": { termZh: "买入—借款—持有至死亡" },
  futures: { termZh: "期货" },
  swap: { termZh: "互换" },
  "interest rate": { termZh: "利率" },
  inflation: { termZh: "通胀" },
  "real rate": { termZh: "实际利率" },
  bond: { termZh: "债券" },
  "yield curve": { termZh: "收益率曲线" },
  "quantitative easing": { termZh: "量化宽松" },
  spot: { termZh: "现货" },
  basis: { termZh: "基差" },
  contango: { termZh: "期货升水" },
  backwardation: { termZh: "期货贴水" },
  "cost of carry": { termZh: "持仓成本" },
};

export function localizedTerm(id: string) {
  return termLocalization[id] ?? { termZh: id };
}

/**
 * The Chinese name to show for a concept.
 *
 * Generated packs carry it on the concept itself (`termZh`); the hand-written
 * pack keeps its glosses in the table above. Reading only the table made every
 * T1-T5 term render its English name as the "Chinese" gloss — the glossary
 * showed `indexindex`, `auctionauction` — because the fallback is the id.
 */
export function zhTermFor(concept: { id: string; term: string; termZh?: string }): string | undefined {
  const value = concept.termZh ?? termLocalization[concept.id]?.termZh;
  if (!value) return undefined;
  // A gloss identical to the English term is not a translation.
  return value.toLowerCase() === concept.term.toLowerCase() ? undefined : value;
}
