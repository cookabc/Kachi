import type { Concept, Course, LearnerState, MasteryState } from "./domain";

/** Lookup stays inside a course: "margin" must never select another pack's sense. */
export function findConcept(course: Course, query: string): Concept | undefined {
  const exact = course.concepts.find((concept) => concept.id === query);
  if (exact) return exact;
  const key = query.trim().toLowerCase();
  const matches = course.concepts.filter((concept) =>
    [concept.term, ...(concept.aliases ?? [])].some((term) => term.toLowerCase() === key),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

const canonicalId = (id: string) => (id === "capital expenditure" ? "capex" : id);
const pairId = (ids: string[]) => [...new Set(ids)].sort().join("::");

/**
 * One-time vocabulary migration. Lesson completion, XP and answer results stay
 * intact. Historic attempts keep their event/exercise ids and content versions.
 * Only concept references change. Ambiguous seen-only margin records do not
 * count as evidence for either meaning.
 */
export function migrateVocabulary(state: LearnerState): LearnerState {
  if ((state.vocabularyRevision ?? 0) >= 1) return state;
  const collateralPairs = new Set<string>(["leverage::margin", "collateral::margin", "margin::margin call"]);
  const profitPairs = new Set<string>();
  let sawCollateral = state.completedLessonIds.some((id) => /^hedge-or-pledge\/u1(?:l3|r)$/.test(id));
  let sawProfit = state.completedLessonIds.some((id) =>
    /^(?:t1-finance-news\/u3|t2-company-earnings\/u1)/.test(id),
  );
  const attempts = state.attempts.map((event) => {
    const hasMargin =
      event.conceptIds.includes("margin") || event.confusionPairId?.split("::").includes("margin");
    const collateral = Boolean(hasMargin && /(?:^|\/)u\d+(?:l\d+|r)[a-z]+$/.test(event.exerciseId));
    if (hasMargin) {
      if (collateral) {
        sawCollateral = true;
        if (event.confusionPairId) collateralPairs.add(event.confusionPairId);
      } else {
        sawProfit = true;
        if (event.confusionPairId) profitPairs.add(event.confusionPairId);
      }
    }
    const idFor = (id: string) => (collateral && id === "margin" ? "margin-collateral" : canonicalId(id));
    const conceptIds = [...new Set(event.conceptIds.map(idFor))];
    const confusionPairId = event.confusionPairId
      ? pairId(event.confusionPairId.split("::").map(idFor))
      : undefined;
    return {
      ...event,
      conceptIds,
      ...(event.confusionPairId
        ? { confusionPairId: confusionPairId?.includes("::") ? confusionPairId : undefined }
        : {}),
    };
  });

  const mastery: Record<string, MasteryState> = {};
  for (const [oldKey, value] of Object.entries(state.mastery)) {
    if (oldKey === "margin::profit") sawProfit = true;
    const collateral = collateralPairs.has(oldKey) && !profitPairs.has(oldKey);
    if (collateral) sawCollateral = true;
    const key = pairId(
      oldKey.split("::").map((id) => (collateral && id === "margin" ? "margin-collateral" : canonicalId(id))),
    );
    if (!key.includes("::")) continue;
    const candidate = { ...value, confusionPairId: key };
    const previous = mastery[key];
    // Alias records describe the same skill. Keep the latest evidence, never
    // sum correct streaks (which would manufacture mastery).
    const stamp = (item: MasteryState) => Date.parse(item.lastReviewedAt ?? item.firstSeenAt ?? "") || 0;
    if (
      !previous ||
      stamp(candidate) > stamp(previous) ||
      (stamp(candidate) === stamp(previous) && candidate.consecutiveCorrect < previous.consecutiveCorrect)
    ) {
      mastery[key] = candidate;
    }
  }
  const seen = state.seenConceptIds.filter((id) => id !== "margin").map(canonicalId);
  if (sawProfit && state.seenConceptIds.includes("margin")) seen.push("margin");
  if (sawCollateral) seen.push("margin-collateral");
  return { ...state, vocabularyRevision: 1, seenConceptIds: [...new Set(seen)], attempts, mastery };
}
