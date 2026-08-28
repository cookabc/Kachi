import type { LocalizedTerm } from "@kachi/domain";

export const termLocalization: Record<string, LocalizedTerm> = {
  hedge: { termZh: "对冲", definitionZh: "为已经持有的风险敞口买保护，而不是卖掉原来的资产。", mixUpWhyZh: "对冲是保护已有仓位；抵押是拿资产为借款作担保。" },
  pledge: { termZh: "抵押／质押", definitionZh: "把资产作为担保；不还款时，出借人可以处置它。", mixUpWhyZh: "仍然持有资产不代表没有风险：质押的是担保，不是对冲。" },
  collateral: { termZh: "抵押品", definitionZh: "借款人违约时，出借方可以取得的资产。", mixUpWhyZh: "抵押品是资产本身；折扣率是它被认可的价值折减。" },
  haircut: { termZh: "折扣率", definitionZh: "出借方按低于市值的金额认定抵押品价值。", mixUpWhyZh: "折扣率是抵押品估值的折减；保证金是账户需要维持的缓冲。" },
  margin: { termZh: "保证金", definitionZh: "维持杠杆仓位所需的现金或权益缓冲。", mixUpWhyZh: "保证金是缓冲；杠杆是这层缓冲支撑的仓位规模。" },
  "margin call": { termZh: "追缴保证金", definitionZh: "缓冲不足时，券商或出借方要求补钱、补担保或平仓。", mixUpWhyZh: "折扣率通常在开始时设定；追缴发生在价格变化之后。" },
  leverage: { termZh: "杠杆", definitionZh: "用借款或衍生品把可承担的仓位放大。", mixUpWhyZh: "杠杆描述放大倍数；保证金描述支撑它的缓冲。" },
  derivative: { termZh: "衍生品", definitionZh: "价值来自另一种资产、利率或指数的合约。", mixUpWhyZh: "期权只是衍生品的一种；期货和互换也是。" },
  option: { termZh: "期权", definitionZh: "按约定价格买卖的权利，而不是必须履行的义务。", mixUpWhyZh: "期权可以放弃；期货通常必须结算。" },
  put: { termZh: "看跌期权", definitionZh: "以约定价格卖出的权利，价格下跌时通常更有价值。", mixUpWhyZh: "Put 是卖出权；Call 是买入权。" },
  call: { termZh: "看涨期权", definitionZh: "以约定价格买入的权利，价格上涨时通常更有价值。", mixUpWhyZh: "Call 是买入权；Put 是卖出权。" },
  "short selling": { termZh: "卖空", definitionZh: "先借入并卖出资产，期待日后以更低价格买回归还。", mixUpWhyZh: "看跌期权的损失有限于权利金；卖空可能面临更大的损失。" },
  liquidity: { termZh: "流动性", definitionZh: "在不显著冲击价格的情况下快速买卖的能力。", mixUpWhyZh: "流动性是退出难易；名义金额是合约面值规模。" },
  notional: { termZh: "名义金额", definitionZh: "衍生合约所对应的标的面值规模，不等于实际支付金额。", mixUpWhyZh: "名义金额是标的规模；权利金是购买合约的价格。" },
  premium: { termZh: "权利金", definitionZh: "购买期权或保险型保护所支付的价格。", mixUpWhyZh: "权利金是合约价格；收益率是投资回报率。" },
  yield: { termZh: "收益率", definitionZh: "投资带来的收益相对于价格的比例。", mixUpWhyZh: "收益率描述收入比例；久期描述利率变化的价格敏感度。" },
  duration: { termZh: "久期", definitionZh: "债券价格对利率变化的敏感程度。", mixUpWhyZh: "久期关注利率冲击下的价格变化；收益率关注收入比例。" },
  "basis risk": { termZh: "基差风险", definitionZh: "对冲工具与被保护对象没有同步变化的风险。", mixUpWhyZh: "对冲是保护动作；基差风险是保护没有贴合的风险。" },
  long: { termZh: "做多", definitionZh: "持有资产或押注其价格上涨。", mixUpWhyZh: "做多希望上涨；卖空通常希望下跌。" },
  volatility: { termZh: "波动率", definitionZh: "价格上下摆动的幅度与剧烈程度，而不是方向。", mixUpWhyZh: "波动率描述单一资产如何摇摆；分散化是组合层面的风险管理。" },
  diversification: { termZh: "分散化", definitionZh: "持有不同资产，降低单一事件造成的组合冲击。", mixUpWhyZh: "分散化分摊风险；对冲是对特定风险买保护。" },
  counterparty: { termZh: "交易对手方", definitionZh: "合约另一端、对你负有履约义务的一方。", mixUpWhyZh: "交易对手方是谁；违约是它没有履约。" },
  default: { termZh: "违约", definitionZh: "未能按合同支付或履行义务。", mixUpWhyZh: "盯市是重新估值；违约是实际没有履约。" },
  "mark-to-market": { termZh: "盯市", definitionZh: "用当前市场价格重新评估未平仓头寸。", mixUpWhyZh: "盯市只是重新定价；违约是没有按合同履行。" },
  "securities-backed loan": { termZh: "证券质押贷款", definitionZh: "以证券组合为担保取得贷款，通常仍持有证券。", mixUpWhyZh: "质押是动作；证券质押贷款是以该动作形成的具体产品。" },
  "capital gains": { termZh: "资本利得", definitionZh: "出售资产价格高于成本时产生的收益概念。", mixUpWhyZh: "资本利得通常与出售相关；buy-borrow-die 描述的是避免出售的模式。" },
  "buy-borrow-die": { termZh: "买入—借款—持有至死亡", definitionZh: "美国语境下对长期持有并以资产借款的一种描述，不是建议。", mixUpWhyZh: "证券质押贷款是其中的工具；这是一整套行为模式。" },
  futures: { termZh: "期货", definitionZh: "在约定日期按约定价格买卖的义务型合约。", mixUpWhyZh: "期货通常需要履约；期权提供选择权。" },
  swap: { termZh: "互换", definitionZh: "双方在一段时间内交换现金流的合约。", mixUpWhyZh: "互换是持续现金流交换；期货更像某一日期的结算义务。" }
};

export function localizedTerm(id: string) {
  return termLocalization[id] ?? {
    termZh: id,
    definitionZh: "中文说明待社区补充。",
    mixUpWhyZh: "中文辨析待社区补充。"
  };
}
