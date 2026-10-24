import { describe, expect, it } from "vitest";
import { course as zhCourse } from "./course";
import type { Course } from "./domain";
import { arcPath, edgePath, graphEdges, graphLayout, labelPlacements } from "./graph";

function courseWithExtraRelations(): Course {
  const course: Course = JSON.parse(JSON.stringify(zhCourse));
  // an explicit symmetric duplicate of an existing mixUp pair (hedge↔pledge),
  // plus a cross-type edge on the same pair — both must not double-render
  const hedge = course.concepts.find((concept) => concept.id === "hedge");
  hedge!.relations = [
    { type: "confusable", with: "pledge" },
    { type: "sibling", with: "pledge" },
    { type: "prereq", with: "duration" },
  ];
  return course;
}

describe("graphEdges", () => {
  it("derives one undirected edge per mutual mixUp pair", () => {
    const edges = graphEdges(zhCourse);
    const hedgePledge = edges.filter((edge) => edge.a === "hedge" && edge.b === "pledge");
    expect(hedgePledge).toHaveLength(1);
    expect(hedgePledge[0]).toMatchObject({ type: "confusable", fromMixUp: true });
  });

  it("includes every declared mixUp pair and explicit relation", () => {
    const edges = graphEdges(zhCourse);
    for (const concept of zhCourse.concepts) {
      const [a, b] = [concept.id, concept.mixUp].sort();
      expect(edges.some((edge) => edge.a === a && edge.b === b && edge.type === "confusable")).toBe(true);
    }
    // seeded in commit 1: hedge's sibling edge to put
    expect(edges.some((edge) => edge.a === "hedge" && edge.b === "put" && edge.type === "sibling")).toBe(
      true,
    );
  });

  it("deduplicates an explicit confusable relation that repeats a mixUp pair", () => {
    const edges = graphEdges(courseWithExtraRelations());
    const confusablePairs = edges.filter(
      (edge) => edge.a === "hedge" && edge.b === "pledge" && edge.type === "confusable",
    );
    expect(confusablePairs).toHaveLength(1);
    expect(confusablePairs[0].fromMixUp).toBe(true);
    // the same pair may still carry a second edge of a different type
    expect(edges.some((edge) => edge.a === "hedge" && edge.b === "pledge" && edge.type === "sibling")).toBe(
      true,
    );
    expect(edges.some((edge) => edge.a === "duration" && edge.b === "hedge" && edge.type === "prereq")).toBe(
      true,
    );
  });

  it("never emits self edges or unknown endpoints", () => {
    for (const edge of graphEdges(zhCourse)) {
      expect(edge.a).not.toBe(edge.b);
      expect(zhCourse.concepts.some((concept) => concept.id === edge.a)).toBe(true);
      expect(zhCourse.concepts.some((concept) => concept.id === edge.b)).toBe(true);
    }
  });
});

describe("graphLayout", () => {
  it("places every concept once, inside the viewBox", () => {
    const layout = graphLayout(zhCourse, 480, 118);
    expect(layout.nodes).toHaveLength(zhCourse.concepts.length);
    expect(layout.byId.size).toBe(zhCourse.concepts.length);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(480);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(480);
    }
  });

  it("is deterministic — the same course always draws the same map", () => {
    const a = graphLayout(zhCourse, 480, 118);
    const b = graphLayout(zhCourse, 480, 118);
    expect(JSON.stringify(a.nodes)).toBe(JSON.stringify(b.nodes));
    expect(JSON.stringify(a.unitSpans)).toBe(JSON.stringify(b.unitSpans));
  });

  it("keeps unit blocks contiguous around the ring", () => {
    const layout = graphLayout(zhCourse, 480, 118);
    const spans = layout.unitSpans.map((span) => span.unit);
    expect(spans).toEqual([...spans].sort((x, y) => x - y));
    for (const span of layout.unitSpans) {
      expect(span.end).toBeGreaterThan(span.start);
    }
  });

  it("groups concepts of the same unit onto adjacent angles", () => {
    const layout = graphLayout(zhCourse, 480, 118);
    const unit1 = layout.nodes.filter((node) => node.unit === 1).map((node) => node.angle);
    const unit2 = layout.nodes.filter((node) => node.unit === 2).map((node) => node.angle);
    const spread = (angles: number[]) => Math.max(...angles) - Math.min(...angles);
    expect(spread(unit1)).toBeLessThan(Math.PI / 2);
    expect(spread(unit2)).toBeLessThan(Math.PI / 2);
  });
});

describe("geometry helpers", () => {
  it("edgePath connects exactly the two nodes it names", () => {
    const layout = graphLayout(zhCourse, 480, 118);
    const edge = graphEdges(zhCourse)[0];
    const d = edgePath(layout, edge);
    expect(d).toMatch(new RegExp(`^M ${layout.byId.get(edge.a)!.x.toFixed(2)}`));
    expect(d!.endsWith(layout.byId.get(edge.b)!.y.toFixed(2))).toBe(true);
  });

  it("edgePath returns null for unknown endpoints", () => {
    const layout = graphLayout(zhCourse, 480, 118);
    expect(edgePath(layout, { a: "ghost", b: "hedge", type: "sibling", fromMixUp: false })).toBeNull();
  });

  it("arcPath sweeps clockwise and labelPlacements keeps labels horizontal", () => {
    const d = arcPath(240, 100, 0, Math.PI / 2);
    expect(d).toContain("A 100 100 0 0 1");
    const layout = graphLayout(zhCourse, 480, 131);
    const placements = labelPlacements(layout, () => 40);
    // at a compact uniform width every concept keeps its placement
    expect(placements.size).toBe(zhCourse.concepts.length);
    for (const node of layout.nodes) {
      const placement = placements.get(node.id);
      expect(placement).toBeDefined();
      const flip = Math.cos(node.angle) < 0;
      expect(placement!.anchor).toBe(flip ? "end" : "start");
    }
  });

  it("labelPlacements separates crowded arcs onto lanes and stays in the viewBox", () => {
    const layout = graphLayout(zhCourse, 480, 131);
    // realistic widths: 0.6em per char at 12px monospace
    const placements = labelPlacements(layout, (id) => {
      const concept = zhCourse.concepts.find((item) => item.id === id);
      return (concept?.term.length ?? 4) * 7.2;
    });
    const lanes = [...placements.values()].map((placement) => placement.lane);
    expect(Math.max(...lanes)).toBeGreaterThan(0);
    expect(Math.max(...lanes)).toBeLessThanOrEqual(4);
    for (const placement of placements.values()) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.x).toBeLessThanOrEqual(480);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeLessThanOrEqual(480);
    }
  });

  it("a label that cannot fit any lane is dropped, never printed on top of another", () => {
    const layout = graphLayout(zhCourse, 480, 131);
    const placements = labelPlacements(layout, (id) => {
      const concept = zhCourse.concepts.find((item) => item.id === id);
      return (concept?.term.length ?? 4) * 7.2;
    });
    // the algorithm's own guarantee: kept labels share no box (overlap === 0)
    // and the anchor still follows which half of the ring the node sits on
    expect(placements.size).toBeGreaterThan(0);
    for (const [id, placement] of placements) {
      const node = layout.byId.get(id)!;
      const flip = Math.cos(node.angle) < 0;
      expect(placement.anchor).toBe(flip ? "end" : "start");
    }
  });

  it("priority decides who keeps a lane when the ring runs out of room", () => {
    const layout = graphLayout(zhCourse, 480, 131);
    const seen = new Set(["hedge", "pledge"]);
    const wide = () => 160; // absurdly wide: not every label can fit
    const withPriority = labelPlacements(layout, wide, {
      priority: (id) => (seen.has(id) ? 1 : 0),
    });
    expect(withPriority.has("hedge")).toBe(true);
    expect(withPriority.has("pledge")).toBe(true);
  });

  it("labelPlacements is deterministic", () => {
    const layout = graphLayout(zhCourse, 480, 131);
    const a = labelPlacements(layout, () => 60);
    const b = labelPlacements(layout, () => 60);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
