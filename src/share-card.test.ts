import { describe, expect, it } from "vitest";
import enCourse from "../content/packs/hedge-or-pledge/en-US/course.json";
import zhCourse from "../content/packs/hedge-or-pledge/zh-CN/course.json";
import type { Concept, Course } from "./domain";
import { conceptOf } from "./flow";
import {
  buildPairCardSvg,
  CARD_HEIGHT,
  CARD_WIDTH,
  layoutPairCard,
  measureText,
  type PairCardInput,
  wrapText,
} from "./share-card";

const packs: Array<[string, Course]> = [
  ["zh-CN", zhCourse as Course],
  ["en-US", enCourse as Course],
];

function pairInput(course: Course, concept: Concept, unitLabel: string): PairCardInput {
  const sibling = conceptOf(course, concept.mixUp);
  if (!sibling) throw new Error(`${concept.id} has no mix-up sibling`);
  const unit = course.units.find((u) => u.id === concept.unit);
  return {
    kicker: `Kachi / ${unitLabel} ${concept.unit} / ${unit?.title ?? ""}`,
    termA: concept.term,
    forkA: concept.definition,
    termB: sibling.term,
    forkB: sibling.definition,
    example: concept.example,
    artA: concept.id,
    artB: sibling.id,
  };
}

describe("pair card layout", () => {
  it.each(packs)("every concept pair in %s fits within the card budget", (locale, course) => {
    const unitLabel = locale === "zh-CN" ? "单元" : "Unit";
    for (const concept of course.concepts) {
      const layout = layoutPairCard(pairInput(course, concept, unitLabel));
      expect(layout, `${locale}/${concept.id}`).not.toBeNull();
      expect(layout?.termA.lines.length).toBeLessThanOrEqual(2);
      expect(layout?.termB.lines.length).toBeLessThanOrEqual(2);
      expect(layout?.kicker.lines).toHaveLength(1);
    }
  });

  it.each(packs)("no glyph boxes overlap and whitespace is balanced in %s", (locale, course) => {
    const unitLabel = locale === "zh-CN" ? "单元" : "Unit";
    const ASCENT = 0.8;
    const DESCENT = 0.25;
    const CONTENT_TOP = 72 + 56;
    const BUDGET_BOTTOM = CARD_HEIGHT - 72 - 56 - 72;
    for (const concept of course.concepts) {
      const layout = layoutPairCard(pairInput(course, concept, unitLabel));
      if (!layout) throw new Error(`${locale}/${concept.id} does not fit`);
      const s = layout.sizes;
      const lastBase = (block: { firstBaseline: number; lineHeight: number; lines: string[] }) =>
        block.firstBaseline + (block.lines.length - 1) * block.lineHeight;
      const gaps = [
        layout.termA.firstBaseline - layout.kicker.firstBaseline - (30 * DESCENT + s.term * ASCENT),
        layout.forkA.firstBaseline - lastBase(layout.termA) - (s.term * DESCENT + s.fork * ASCENT),
        layout.termB.firstBaseline - layout.duelY - s.term * ASCENT,
        layout.forkB.firstBaseline - lastBase(layout.termB) - (s.term * DESCENT + s.fork * ASCENT),
        layout.panel.y - lastBase(layout.forkB) - s.fork * DESCENT,
      ];
      for (const gap of gaps) expect(gap, `${locale}/${concept.id}`).toBeGreaterThanOrEqual(0);
      expect(layout.duelY - lastBase(layout.forkA)).toBeGreaterThanOrEqual(s.fork * DESCENT);
      const panelBottom = layout.panel.y + layout.panel.height;
      expect(panelBottom).toBeLessThanOrEqual(BUDGET_BOTTOM + 1);
      const slackTop = layout.topY - CONTENT_TOP;
      const slackBottom = BUDGET_BOTTOM - panelBottom;
      expect(Math.abs(slackTop - slackBottom), `${locale}/${concept.id} not centered`).toBeLessThanOrEqual(
        s.example * 1.45,
      );
    }
  });

  it("guards the documented content extremes still exist", () => {
    const all = packs.flatMap(([, course]) => course.concepts);
    const termLen = Math.max(...all.map((c) => c.term.length));
    const defLen = Math.max(...all.map((c) => c.definition.length));
    const zhExLen = Math.max(...(zhCourse as Course).concepts.map((c) => c.example.length));
    expect(termLen).toBeGreaterThanOrEqual(22);
    expect(defLen).toBeGreaterThanOrEqual(136);
    expect(zhExLen).toBeGreaterThanOrEqual(62);
  });

  it("steps down tiers together for long content", () => {
    const longPair: PairCardInput = {
      kicker: "Kachi / Unit 5 / What the Rich Actually Do",
      termA: "securities-backed loan",
      forkA:
        "Borrowing against a portfolio you keep, so the bank can sell your securities if the value drops and you cannot top up the collateral in time.",
      termB: "buy-borrow-die",
      forkB:
        "Buy appreciating assets, borrow against them for spending, and hold until death so heirs may receive a reset cost basis.",
      example:
        "You hold $4M of stock, borrow $1M against it at the bank, and never sell a single share along the way.",
    };
    const layout = layoutPairCard(longPair);
    expect(layout).not.toBeNull();
    expect(layout?.tier).toBeGreaterThan(0);
  });

  it("refuses content that cannot fit at the floor size instead of truncating", () => {
    const impossible: PairCardInput = {
      kicker: "Kachi",
      termA: "hedge",
      forkA: "word ".repeat(400).trim(),
      termB: "pledge",
      forkB: "short",
      example: "short",
    };
    expect(layoutPairCard(impossible)).toBeNull();
    expect(() => buildPairCardSvg(impossible)).toThrow(/floor size/);
  });
});

describe("wrapText", () => {
  it("breaks latin text only at spaces or after hyphens", () => {
    const lines = wrapText("securities-backed loan", 88, 824);
    expect(lines).not.toBeNull();
    for (const line of lines ?? []) {
      expect(measureText(line, 88)).toBeLessThanOrEqual(824);
      expect(/^[a-z]/.test(line) || /-$/.test(line) || line.length === 1).toBe(true);
    }
    expect(lines?.join(" ").replace(/- /g, "-")).toBe("securities-backed loan");
  });

  it("breaks CJK text per character without splitting embedded latin words", () => {
    const lines = wrapText(
      "买入资产，押着借钱消费，持有至去世让继承人可能获得成本基础重置。hedge 不卖出。",
      42,
      824,
    );
    expect(lines).not.toBeNull();
    for (const line of lines ?? []) {
      expect(measureText(line, 42)).toBeLessThanOrEqual(824);
    }
    expect(lines?.join("")).toBe(
      "买入资产，押着借钱消费，持有至去世让继承人可能获得成本基础重置。hedge 不卖出。",
    );
  });

  it("preserves original spaces between CJK and latin, drops CJK-CJK spaces", () => {
    expect(wrapText("单元 1 / Hedge or Pledge", 30, 824)?.join("")).toBe("单元 1 / Hedge or Pledge");
    expect(wrapText("买入一张 put，崩盘时就不那么疼。", 38, 744)?.join("")).toBe(
      "买入一张 put，崩盘时就不那么疼。",
    );
    expect(wrapText("单元 测试", 42, 824)?.join("")).toBe("单元测试");
  });

  it("never starts a line with closing punctuation or ends one with opening punctuation", () => {
    const samples = [
      "你持有 $100,000 的股票，买入一张 put，崩盘时就不那么疼。",
      "买入资产，押着借钱消费，持有至去世让继承人可能获得成本基础重置。一种税务模式——不是我们推荐的做法。",
      "双方在一段时间内交换现金流的合约，常见的是固定利率换浮动利率。",
    ];
    for (const sample of samples) {
      const lines = wrapText(sample, 38, 744);
      expect(lines, sample).not.toBeNull();
      for (const line of lines ?? []) {
        expect(line, sample).not.toMatch(/^[，。；：？！、…」』）》〉”’]/);
        expect(line, sample).not.toMatch(/[「『（《〈“‘]$/);
        expect(measureText(line, 38), sample).toBeLessThanOrEqual(744 + 38 * 1.04);
      }
    }
  });

  it("returns null when a single atom exceeds the measure", () => {
    expect(wrapText("supercalifragilisticexpialidocious", 88, 100)).toBeNull();
  });

  it("rebalances an orphan last line in CJK text without changing content", () => {
    const lines = wrapText("为已经持有的仓位买保险，而不是把它卖掉。", 42, 824);
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(2);
    expect(measureText(lines![1], 42)).toBeGreaterThanOrEqual(824 * 0.3);
    expect(lines!.join("")).toBe("为已经持有的仓位买保险，而不是把它卖掉。");
  });

  it.each(packs)("keeps every block's last line off orphan width in %s", (locale, course) => {
    const unitLabel = locale === "zh-CN" ? "单元" : "Unit";
    const floor = { fork: 36, example: 34 };
    for (const concept of course.concepts) {
      const input = pairInput(course, concept, unitLabel);
      const blocks: Array<[string, string[] | null, number, number]> = [
        ["forkA", wrapText(input.forkA, floor.fork, 824), floor.fork, 824],
        ["forkB", wrapText(input.forkB, floor.fork, 824), floor.fork, 824],
        ["example", wrapText(input.example, floor.example, 756), floor.example, 756],
      ];
      for (const [name, lines, size, measure] of blocks) {
        if (!lines || lines.length < 2) continue;
        const last = lines[lines.length - 1];
        const prev = lines[lines.length - 2];
        // when the previous line had plenty to give, the last line must not be an orphan
        if (measureText(prev, size) < measure * 0.5) continue;
        expect(
          measureText(last, size),
          `${locale}/${concept.id}/${name}: ${lines.join("|")}`,
        ).toBeGreaterThanOrEqual(measure * 0.3);
      }
    }
  });
});

describe("buildPairCardSvg", () => {
  const sample: PairCardInput = {
    kicker: "Kachi / 单元 1 / Hedge or Pledge",
    termA: "hedge",
    forkA: "为已经持有的仓位买保险，而不是把它卖掉。",
    termB: "pledge",
    forkB: "把资产押出去做担保；还不上钱时，贷方可以处置它。",
    example: "你持有 $100,000 的股票，买入一张 put，崩盘时就不那么疼。",
  };

  it("produces a deterministic, well-formed SVG document", () => {
    const svg = buildPairCardSvg(sample);
    expect(svg).toBe(buildPairCardSvg(sample));
    expect(
      svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}"`),
    ).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });

  it("escapes XML-sensitive characters in card copy", () => {
    const tricky: PairCardInput = {
      kicker: "A & B",
      termA: 'a<b>"c"',
      forkA: "5 > 3 & 2 < 4",
      termB: "it's",
      forkB: "fine",
      example: "Tom & Jerry",
    };
    const svg = buildPairCardSvg(tricky);
    expect(svg).toContain("a&lt;b&gt;&quot;c&quot;");
    expect(svg).toContain("5 &gt; 3 &amp; 2 &lt; 4");
    expect(svg).toContain("it&apos;s");
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("contains no learner data fields beyond the given copy", () => {
    const svg = buildPairCardSvg(sample);
    expect(svg).not.toMatch(/XP|streak|accuracy|正确率/i);
  });

  it("embeds both duel scenes when art ids resolve", () => {
    const svg = buildPairCardSvg({ ...sample, artA: "hedge", artB: "pledge" });
    expect(svg.match(/class="duel-art"/g)).toHaveLength(2);
    expect(svg).toContain("<circle");
    expect(svg).not.toContain('stroke="#dceee4"');
  });

  it("falls back to hairline flanks when no scene resolves", () => {
    const svg = buildPairCardSvg(sample);
    expect(svg).not.toContain("duel-art");
    expect(svg).toContain('stroke="#e3dfe6"');
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });

  it("embeds every published pair's scenes without breaking well-formedness", () => {
    for (const [locale, course] of packs) {
      const unitLabel = locale === "zh-CN" ? "单元" : "Unit";
      for (const concept of course.concepts) {
        const svg = buildPairCardSvg(pairInput(course, concept, unitLabel));
        const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
        expect(parsed.querySelector("parsererror"), `${locale}/${concept.id}`).toBeNull();
        expect(svg.match(/class="duel-art"/g), `${locale}/${concept.id}`).toHaveLength(2);
      }
    }
  });
});
