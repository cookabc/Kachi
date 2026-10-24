import type { Course, RelationType } from "../domain";
import { conceptOf } from "../flow";

/**
 * Finding the learner's weak link.
 *
 * The knowledge map shows every term and every relation between them. It is
 * a picture, but a picture of what? A learner wants to know one thing:
 * *why am I stuck?*
 *
 * The answer is a chain. A "prereq" edge says term A leans on term B — so
 * not knowing B is a reason not to know A. That gives a directed structure
 * hidden inside the undirected map the reader can see.
 *
 * This module walks those prereq chains backwards from the terms the learner
 * has not met, and reports the shallowest ones: the unseen concepts that
 * are closest to what the learner already knows. Those are the ones worth
 * learning next, because unlocking them unblocks the most.
 *
 * Everything is pure and deterministic.
 */

export interface WeakLink {
  /** The concept the learner has not met yet. */
  id: string;
  /** Its term, for display. */
  term: string;
  /** Why it is worth learning: the path of prereqs from what the learner
   *  already knows down to this term. Empty when the term has no known
   *  prereq and is simply unexplored. */
  chain: string[];
  /** How many learned terms this one would unlock. */
  unlocks: number;
  /** The unit the term belongs to. */
  unit: number;
}

/**
 * The prereq edges, as a directed map from a term to the terms it depends
 * on.
 *
 * The course declares relations on one side only, but they are undirected in
 * the map's own semantics ("this term leans on that term"), so the declared
 * side is what counts: a "prereq" relation on A means A depends on B.
 */
export function prereqMap(course: Course): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const concept of course.concepts) {
    for (const relation of concept.relations ?? []) {
      if (relation.type !== "prereq") continue;
      if (!conceptOf(course, relation.with)) continue;
      const list = map.get(concept.id) ?? [];
      if (!list.includes(relation.with)) list.push(relation.with);
      map.set(concept.id, list);
    }
  }
  return map;
}

/**
 * The learner's weak links: the unseen terms closest to what they know.
 *
 * A term is "close" when some learned term reaches it through prereq edges.
 * The closer it is, the more it explains why they are stuck — and the more
 * other terms it unlocks.
 *
 * @param seenIds  Terms the learner has already met.
 * @param limit    How many weak links to report.
 */
export function weakLinks(course: Course, seenIds: string[], limit = 3): WeakLink[] {
  const seen = new Set(seenIds);
  const prereqs = prereqMap(course);

  // Reverse the map: a term that others depend on.
  const dependents = new Map<string, string[]>();
  for (const [term, needs] of prereqs) {
    for (const need of needs) {
      const list = dependents.get(need) ?? [];
      if (!list.includes(term)) list.push(term);
      dependents.set(need, list);
    }
  }

  // How many terms does each term ultimately unlock? Count the terms that
  // depend on it, directly or through other prereqs.
  const unlocksOf = (start: string): number => {
    const found = new Set<string>();
    const queue = [...(dependents.get(start) ?? [])];
    while (queue.length) {
      const current = queue.pop() as string;
      if (found.has(current)) continue;
      found.add(current);
      for (const next of dependents.get(current) ?? []) queue.push(next);
    }
    return found.size;
  };

  const results: WeakLink[] = [];

  for (const concept of course.concepts) {
    if (seen.has(concept.id)) continue;

    // The shortest prereq path from a learned term to this one.
    const chain = shortestChainFrom(concept.id, prereqs, seen);
    const unlocks = unlocksOf(concept.id);

    // A term with no path from anything learned is simply unexplored — it
    // is not a weak link, it is just the next unit. It is reported last,
    // and only if there is room.
    const score = (chain.length === 0 ? 100 : chain.length) - unlocks * 0.5;
    results.push({
      id: concept.id,
      term: concept.term,
      chain,
      unlocks,
      unit: concept.unit,
      score,
    } as WeakLink & { score: number });
  }

  // Rank: a shorter chain from known material first; among equals, the one
  // that unlocks the most.
  results.sort((a, b) => {
    const aScore = (a as WeakLink & { score: number }).score;
    const bScore = (b as WeakLink & { score: number }).score;
    if (aScore !== bScore) return aScore - bScore;
    return a.term.localeCompare(b.term);
  });

  const linked = results.filter((r) => r.chain.length > 0);
  const rest = results.filter((r) => r.chain.length === 0);
  return [...linked, ...rest].slice(0, limit);
}

/**
 * The shortest chain of prereqs from any learned term down to `target`.
 *
 * The chain is ordered from the learned term towards the target, so it can
 * be read as "you know X, and X depends on Y, and Y depends on Z".
 */
function shortestChainFrom(target: string, prereqs: Map<string, string[]>, seen: Set<string>): string[] {
  // Breadth-first from the target upwards: the target's prereqs are what it
  // needs, and we look for a learned term among their ancestors.
  const queue: string[][] = [[target]];
  const visited = new Set<string>([target]);

  while (queue.length) {
    const path = queue.shift() as string[];
    const current = path[path.length - 1];
    const needs = prereqs.get(current) ?? [];
    for (const need of needs) {
      if (visited.has(need)) continue;
      visited.add(need);
      const next = [...path, need];
      if (seen.has(need)) {
        // Found a learned term: the chain runs from it down to the target.
        return next.reverse();
      }
      queue.push(next);
    }
  }
  return [];
}

/**
 * The relation types between two terms, for the map's legend and tooltips.
 */
export function relationBetween(course: Course, a: string, b: string): RelationType[] {
  const types = new Set<RelationType>();
  for (const concept of course.concepts) {
    if (concept.id === a) {
      for (const relation of concept.relations ?? []) {
        if (relation.with === b) types.add(relation.type);
      }
    }
    if (concept.id === b) {
      for (const relation of concept.relations ?? []) {
        if (relation.with === a) types.add(relation.type);
      }
    }
  }
  return Array.from(types);
}
