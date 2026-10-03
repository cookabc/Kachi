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

/** Radial chord-diagram label: text runs outward on the right half, flipped on the left. */
export function labelTransform(node: { angle: number }, center: number, radius: number) {
  const x = center + radius * Math.cos(node.angle);
  const y = center + radius * Math.sin(node.angle);
  const degrees = (node.angle * 180) / Math.PI;
  const flip = Math.cos(node.angle) < 0;
  const rotation = flip ? degrees + 180 : degrees;
  return {
    x,
    y,
    rotation,
    flip,
    anchor: (flip ? "end" : "start") as "end" | "start",
  };
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
