// Fill-the-blank sentences for concepts whose corpus example never uses the
// term itself ("BP posted a second-quarter profit…" teaches `earnings` but
// cannot blank it). Without these the fill item fell back to appending
// "(the word here is ____)" to an unchanged sentence — a question with no real
// gap. Each sentence is original, uses the term exactly once, and is decided by
// the distinction from the concept's mix-up twin rather than by grammar alone.
// Keyed by concept id; shared by both locales because the sentence is English.
export const FILL_OVERRIDES = {
  // T1
  "interest rate": "All three central banks are expected to leave the interest rate unchanged at 4.25%.",
  "exchange rate": "The exchange rate slid past 160 yen per dollar, prompting a warning from Tokyo.",
  appreciate: "The yuan could appreciate further if the dollar keeps weakening.",
  index: "The index fell 1.4%, dragged down by a handful of heavyweight chipmakers.",
  // T2
  earnings: "BP's earnings more than doubled to $5.73 billion once all costs were deducted.",
  eps: "Chevron reported adjusted EPS of $6.06, dividing its profit across fewer shares.",
  opex: "Lower opex per barrel helped margins even as output stayed flat.",
  capex: "The miner raised 2026 capex to $14 billion to build two new pits.",
  beat: "Chevron's results beat expectations, posting its strongest quarterly profit in six years.",
  miss: "Exxon's results were a miss: profit fell short of the analyst consensus.",
  buyback: "Chevron completed a $3 billion buyback during the quarter, cutting its share count.",
  divestiture: "The $2 billion divestiture of its retail arm moves BP closer to its target.",
  "write-down": "BP took a $4 billion write-down on its low-carbon projects.",
  valuation: "At 30 times earnings, the stock's valuation already prices in years of growth.",
  "p/b": "With book value at $38 a share, the stock trades at a P/B of about one.",
  // T3
  price: "As yields rose, the bond's price fell to 97 cents on the dollar.",
  "credit spread": "Investors demanded a credit spread of 180 basis points over Treasuries.",
  // T4
  tightening: "Another rate hike would mark the third step of monetary tightening this year.",
  intervention: "Bank Indonesia's intervention in the currency market slowed the rupiah's slide.",
  "capital flow": "A sudden reversal in capital flow left the country short of dollars.",
  // T5
  "multiple testing": "Running twenty strategies and reporting the best one is a classic multiple testing trap.",
  "max drawdown": "The strategy's max drawdown widened to 31% out of sample.",
  sensitivity: "A sensitivity check showed the result vanished once costs rose by a few basis points.",
};
