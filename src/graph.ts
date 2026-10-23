import type { Course, RelationType } from "./domain";
import { conceptOf } from "./flow";

/* The concept graph: every published term is a node; edges come from the
   canonical mixUp pair (the curriculum's headline confusion) plus the pack's
   explicit relations. Edges are undirected in the view even when the pack
   declares a relation on one side only. */

export interface GraphEdge {
  a: string;
  b: string;
  type: RelationType;
  /** True when this edge exists because one side's mixUp points at the other. */
  fromMixUp: boolean;
}

export function graphEdges(course: Course): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const push = (x: string, y: string, type: RelationType, fromMixUp: boolean) => {
    if (x === y) return;
    const [a, b] = [x, y].sort();
    const key = `${a}::${b}::${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, type, fromMixUp });
  };
  for (const concept of course.concepts) {
    if (conceptOf(course, concept.mixUp)) push(concept.id, concept.mixUp, "confusable", true);
    for (const relation of concept.relations ?? []) {
      if (conceptOf(course, relation.with)) push(concept.id, relation.with, relation.type, false);
    }
  }
  return edges;
}

export interface GraphNodeLayout {
  id: string;
  unit: number;
  x: number;
  y: number;
  /** Polar angle in radians; 0 = three o'clock, decreasing counterclockwise. */
  angle: number;
}

export interface UnitSpan {
  unit: number;
  start: number;
  end: number;
  mid: number;
}

export interface GraphLayout {
  nodes: GraphNodeLayout[];
  byId: Map<string, GraphNodeLayout>;
  unitSpans: UnitSpan[];
  radius: number;
  center: number;
}

/* A chord-diagram layout: terms sit on one ring grouped by unit, with a small
   angular gap between unit blocks. Pure and deterministic — the same course
   always renders the same picture, so the map is learnable territory rather
   than a physics toy. */
export function graphLayout(course: Course, size: number, pad: number): GraphLayout {
  const unitIds = course.units.map((unit) => unit.id);
  const blocks = unitIds.map((unit) => course.concepts.filter((concept) => concept.unit === unit));
  const UNIT_GAP = 0.9; // in node-slot widths
  const totalSlots = blocks.reduce((sum, block) => sum + block.length, 0) + UNIT_GAP * blocks.length;
  const step = (Math.PI * 2) / totalSlots;
  const center = size / 2;
  const radius = center - pad;

  const nodes: GraphNodeLayout[] = [];
  const unitSpans: UnitSpan[] = [];
  let cursor = 0;
  blocks.forEach((block, blockIndex) => {
    const startAngle = -Math.PI / 2 + cursor * step;
    block.forEach((concept, index) => {
      const angle = startAngle + (index + 0.5) * step;
      nodes.push({
        id: concept.id,
        unit: concept.unit,
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
        angle,
      });
    });
    const endAngle = startAngle + block.length * step;
    unitSpans.push({
      unit: unitIds[blockIndex],
      start: startAngle,
      end: endAngle,
      mid: startAngle + (block.length * step) / 2,
    });
    cursor += block.length + UNIT_GAP;
  });

  return {
    nodes,
    byId: new Map(nodes.map((node) => [node.id, node])),
    unitSpans,
    radius,
    center,
  };
}

/** Horizontal label placement on radial lanes.
 *
 *  Rotated labels were unreadable at this scale (11px type at ±80°), so every
 *  label sits horizontally. Crowding is resolved with exact box collision:
 *  nodes are visited in priority order (the caller decides what matters —
 *  misses first, then seen terms, then unseen), and each label takes the
 *  first lane whose box clears every placed box. When every lane collides the
 *  label is dropped instead of printed on top of another one: the dot stays
 *  on the ring and tapping the node still opens the card, so a hidden label
 *  costs a glance, not the information. Lanes that would push a label outside
 *  the viewBox are avoided. Pure and deterministic — the same course always
 *  draws the same map. */
export interface LabelPlacement {
  x: number;
  y: number;
  anchor: "start" | "end";
  lane: number;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function labelPlacements(
  layout: GraphLayout,
  labelWidth: (id: string) => number,
  {
    firstOffset = 12,
    laneGap = 15,
    maxLanes = 5,
    lineHeight = 15.5,
    edgeMargin = 2,
    priority,
  }: {
    firstOffset?: number;
    laneGap?: number;
    maxLanes?: number;
    lineHeight?: number;
    edgeMargin?: number;
    /** Higher wins the inner lanes first; unset means angular order. */
    priority?: (id: string) => number;
  } = {},
): Map<string, LabelPlacement> {
  const boxes: Box[] = [];
  const out = new Map<string, LabelPlacement>();
  const order = [...layout.nodes].sort((a, b) => {
    const pa = priority ? priority(a.id) : 0;
    const pb = priority ? priority(b.id) : 0;
    if (pa !== pb) return pb - pa;
    return a.angle - b.angle;
  });
  const right = layout.center * 2;

  for (const node of order) {
    const w = labelWidth(node.id);
    const flip = Math.cos(node.angle) < 0;
    const place = (lane: number) => {
      const r = layout.radius + firstOffset + lane * laneGap;
      const px = layout.center + r * Math.cos(node.angle);
      const py = layout.center + r * Math.sin(node.angle);
      const x1 = flip ? px - w : px;
      return { px, py, box: { x1, y1: py - lineHeight / 2, x2: x1 + w, y2: py + lineHeight / 2 } as Box };
    };
    const overlapArea = (box: Box) => {
      let area = 0;
      for (const b of boxes) {
        const ox = Math.min(box.x2, b.x2) - Math.max(box.x1, b.x1);
        const oy = Math.min(box.y2, b.y2) - Math.max(box.y1, b.y1);
        if (ox > 0 && oy > 0) area += ox * oy;
      }
      return area;
    };
    const outside = (box: Box) => box.x1 < edgeMargin || box.x2 > right - edgeMargin;

    let bestLane: number | null = null;
    let bestOverlap = Number.POSITIVE_INFINITY;
    for (let lane = 0; lane < maxLanes; lane++) {
      const { box } = place(lane);
      if (outside(box)) continue;
      const overlap = overlapArea(box);
      if (overlap === 0) {
        bestLane = lane;
        bestOverlap = 0;
        break;
      }
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestLane = lane;
      }
    }
    // Nothing clear anywhere: hiding the label beats printing two on one spot.
    if (bestLane === null || bestOverlap > 0) continue;
    const { px, py, box } = place(bestLane);
    boxes.push(box);
    out.set(node.id, { x: px, y: py, anchor: flip ? "end" : "start", lane: bestLane });
  }
  return out;
}

export function arcPath(center: number, radius: number, start: number, end: number): string {
  const x1 = center + radius * Math.cos(start);
  const y1 = center + radius * Math.sin(start);
  const x2 = center + radius * Math.cos(end);
  const y2 = center + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function edgePath(layout: GraphLayout, edge: GraphEdge): string | null {
  const from = layout.byId.get(edge.a);
  const to = layout.byId.get(edge.b);
  if (!from || !to) return null;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${layout.center} ${layout.center} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}
