import type { Concept, Course, Exercise, Lesson, MixUpType } from "../domain";

export interface ValidationIssue {
  path: string;
  message: string;
}

const MIX_UP_TYPES: MixUpType[] = [
  "opposite",
  "coexist",
  "hierarchy",
  "form",
  "timing",
  "scope",
  "direction",
];

function uniqueIssues(ids: string[], label: string): ValidationIssue[] {
  const seen = new Set<string>();
  const duplicate = ids.find((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  return duplicate ? [{ path: label, message: `Duplicate ID: ${duplicate}` }] : [];
}

const RELATION_TYPES = new Set(["confusable", "prereq", "sibling"]);

function validateRelations(concept: Concept, conceptIds: Set<string>): ValidationIssue[] {
  if (concept.relations === undefined) return [];
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(concept.relations)) {
    return [{ path: concept.id, message: "relations must be an array when present" }];
  }
  const seen = new Set<string>();
  concept.relations.forEach((relation, index) => {
    const at = `${concept.id}.relations[${index}]`;
    if (!relation || !RELATION_TYPES.has(relation.type)) {
      issues.push({ path: at, message: `Unknown relation type: ${String(relation?.type)}` });
      return;
    }
    if (!relation.with) {
      issues.push({ path: at, message: "Relation needs a target concept id" });
      return;
    }
    if (relation.with === concept.id) {
      issues.push({ path: at, message: `Relation targets itself: ${relation.with}` });
      return;
    }
    if (!conceptIds.has(relation.with)) {
      issues.push({ path: at, message: `Unknown relation target: ${relation.with}` });
      return;
    }
    const key = `${relation.type}::${relation.with}`;
    if (seen.has(key)) {
      issues.push({ path: at, message: `Duplicate relation: ${key}` });
      return;
    }
    seen.add(key);
  });
  return issues;
}

/**
 * Whether an id is allowed to appear in an exercise: either a published concept
 * or an id art.tsx declares as out-of-syllabus. The former had a per-type
 * exception for match exercises; declaring the ids explicitly made that branch
 * unnecessary.
 */
function isKnownTermId(id: string, conceptIds: Set<string>, outOfSyllabus: ReadonlySet<string>): boolean {
  return conceptIds.has(id) || outOfSyllabus.has(id);
}

function validateExercise(
  exercise: Exercise,
  conceptIds: Set<string>,
  outOfSyllabus: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!exercise.id) issues.push({ path: "exercise", message: "Exercise ID is required" });
  if (!exercise.termIds?.length)
    issues.push({ path: exercise.id, message: "Exercise must reference at least one term" });
  exercise.termIds?.forEach((id) => {
    if (!isKnownTermId(id, conceptIds, outOfSyllabus)) {
      issues.push({ path: exercise.id, message: `Unknown term reference: ${id}` });
    }
  });
  if (["meaning", "scenario", "headline"].includes(exercise.type)) {
    if (!exercise.options?.length || typeof exercise.answer !== "number") {
      issues.push({
        path: exercise.id,
        message: "Choice exercises need non-empty options and a numeric answer",
      });
    } else if (
      !Number.isInteger(exercise.answer) ||
      exercise.answer < 0 ||
      exercise.answer >= exercise.options.length
    ) {
      issues.push({
        path: exercise.id,
        message: `Choice answer ${exercise.answer} is outside options range 0..${exercise.options.length - 1}`,
      });
    }
  }
  if (exercise.type === "truefalse" && typeof exercise.answer !== "boolean") {
    issues.push({ path: exercise.id, message: "True/false exercises need a boolean answer" });
  }
  if (exercise.type === "fill") {
    if (!exercise.bank?.length || typeof exercise.answer !== "string") {
      issues.push({ path: exercise.id, message: "Fill exercises need a non-empty bank and text answer" });
    } else if (!exercise.bank.includes(exercise.answer)) {
      issues.push({
        path: exercise.id,
        message: `Fill answer is not present in the bank: ${exercise.answer}`,
      });
    }
  }
  // A headline drill is only meaningful when its two options ARE the confusable
  // pair: the question is "which of these two fits", not "which of four words
  // fits". Four options would turn it into a vocabulary quiz again.
  if (exercise.type === "headline") {
    if (!exercise.story?.includes("____")) {
      issues.push({ path: exercise.id, message: "Headline drill needs a story with a ____ blank" });
    }
    if (exercise.options?.length !== 2) {
      issues.push({
        path: exercise.id,
        message: `Headline drill needs exactly 2 options (the pair), got ${exercise.options?.length ?? 0}`,
      });
    }
    if (exercise.termIds?.length !== 2) {
      issues.push({ path: exercise.id, message: "Headline drill must reference exactly 2 terms" });
    }
    const optionTexts = (exercise.options ?? []).map((option) => option.text);
    if ([...(exercise.termIds ?? [])].sort().join("|") !== [...optionTexts].sort().join("|")) {
      issues.push({
        path: exercise.id,
        message: "Headline drill options must be exactly its two termIds",
      });
    }
  }
  if (exercise.type === "match") {
    if (!exercise.pairs || exercise.pairs.length < 2) {
      issues.push({ path: exercise.id, message: "Match exercises need at least two pairs" });
    } else {
      const pairIds = exercise.pairs.map((pair) => pair.id);
      const duplicate = pairIds.find((id, index) => pairIds.indexOf(id) !== index);
      if (duplicate) issues.push({ path: exercise.id, message: `Duplicate match pair ID: ${duplicate}` });
      pairIds.forEach((id) => {
        if (!id || !isKnownTermId(id, conceptIds, outOfSyllabus)) {
          issues.push({ path: exercise.id, message: `Unknown match pair ID: ${id}` });
        }
      });
      if (JSON.stringify(exercise.termIds) !== JSON.stringify(pairIds)) {
        issues.push({ path: exercise.id, message: "Match termIds must exactly match pair IDs in order" });
      }
    }
  }
  return issues;
}

export function validateCourse(
  course: Course,
  // Ids with art that are intentionally not concepts. Passed in rather than
  // imported so this module stays loadable by plain Node at build time.
  outOfSyllabus: ReadonlySet<string> = new Set(["sell", "true", "false"]),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (course.schemaVersion !== 1)
    issues.push({ path: "schemaVersion", message: "Unsupported schema version" });
  if (!course.packId || !course.contentVersion || !course.locale) {
    issues.push({ path: "manifest", message: "packId, contentVersion, and locale are required" });
  }

  issues.push(
    ...uniqueIssues(
      course.units.map((unit) => String(unit.id)),
      "units",
    ),
  );
  issues.push(
    ...uniqueIssues(
      course.concepts.map((concept) => concept.id),
      "concepts",
    ),
  );
  issues.push(
    ...uniqueIssues(
      course.lessons.map((lesson) => lesson.id),
      "lessons",
    ),
  );
  const conceptIds = new Set(course.concepts.map((concept) => concept.id));
  const sourceIds = new Set(course.sources.map((source) => source.id));
  const allExercises = course.lessons.flatMap((lesson) => lesson.prompts);
  issues.push(
    ...uniqueIssues(
      allExercises.map((exercise) => exercise.id),
      "exercises",
    ),
  );

  course.concepts.forEach((concept) => {
    if (!concept.mixUp || !conceptIds.has(concept.mixUp)) {
      issues.push({ path: concept.id, message: `Unknown mix-up concept: ${concept.mixUp}` });
    }
    // The teach card renders this label. An unlisted value used to pass
    // validation and then render nothing, so every accepted type is named here.
    if (concept.mixUpType && !MIX_UP_TYPES.includes(concept.mixUpType)) {
      issues.push({ path: concept.id, message: `Unknown mix-up type: ${concept.mixUpType}` });
    }
    concept.sourceIds.forEach((id) => {
      if (!sourceIds.has(id)) issues.push({ path: concept.id, message: `Unknown source: ${id}` });
    });
    issues.push(...conceptProvenanceIssues(concept));
    // Review is the act of standing behind a term, and standing behind it
    // means naming where it comes from. A reviewed concept with no sourceIds
    // would make the word "reviewed" mean nothing, so it fails here rather
    // than at the settings screen's promise.
    if (concept.reviewStatus === "reviewed" && concept.sourceIds.length === 0) {
      issues.push({
        path: concept.id,
        message: "reviewed concepts must cite at least one source (sourceIds is empty)",
      });
    }
    issues.push(...validateRelations(concept, conceptIds));
  });
  allExercises.forEach((exercise) => {
    issues.push(...validateExercise(exercise, conceptIds, outOfSyllabus));
  });
  course.lessons.forEach((lesson) => {
    issues.push(...validateLessonShape(lesson, course));
  });
  course.concepts.forEach((concept) => {
    issues.push(...conceptCoverageIssues(concept, course));
  });
  return issues;
}

// PRD §8: a lesson mixes at least three exercise types (no matching-only or
// drill-only lessons), scenario is mandatory after u1l1, and reviews only
// consolidate taught terms — never a later unit's.
function validateLessonShape(lesson: Lesson, course: Course): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const types = new Set(lesson.prompts.map((prompt) => prompt.type));
  if (types.size < 3) {
    issues.push({
      path: lesson.id,
      message: `Lesson uses ${types.size} exercise type(s); PRD §8 requires at least three`,
    });
  }
  if (lesson.id !== "u1l1" && !types.has("scenario")) {
    issues.push({ path: lesson.id, message: "Lesson after u1l1 must include a scenario exercise (PRD §8)" });
  }
  if (!lesson.review) return issues;
  lesson.prompts.forEach((prompt) => {
    prompt.termIds?.forEach((id) => {
      issues.push(...futureUnitIssues(lesson, id, course));
    });
    prompt.pairs?.forEach((pair) => {
      issues.push(...futureUnitIssues(lesson, pair.id, course));
    });
  });
  return issues;
}

function futureUnitIssues(lesson: Lesson, conceptId: string, course: Course): ValidationIssue[] {
  const concept = course.concepts.find((item) => item.id === conceptId);
  if (!concept || concept.unit <= lesson.unit) return [];
  return [
    {
      path: lesson.id,
      message: `Review lesson references ${conceptId} from unit ${concept.unit} before it is taught`,
    },
  ];
}

// PRD §7: every term earns at least two prompts across at least two exercise types.
function conceptCoverageIssues(concept: Course["concepts"][number], course: Course): ValidationIssue[] {
  const prompts = course.lessons
    .flatMap((lesson) => lesson.prompts)
    .filter((prompt) => prompt.termIds?.includes(concept.id));
  const types = new Set(prompts.map((prompt) => prompt.type));
  if (prompts.length >= 2 && types.size >= 2) return [];
  return [
    {
      path: concept.id,
      message: `Term appears in ${prompts.length} prompt(s) across ${types.size} exercise type(s); PRD §7 requires at least two prompts in two types`,
    },
  ];
}

// PRD §7 "Provenance and freshness" (amended 10 Sep 2026): governed content —
// new drafts and anything promoted to reviewed — must carry the fields its
// risk level relies on. Content marked legacy is exempt from the rule, so no
// id allowlist is needed.
const GOVERNED_REVIEW_STATUSES: ReadonlySet<Concept["reviewStatus"]> = new Set(["draft", "reviewed"]);

function conceptProvenanceIssues(concept: Concept): ValidationIssue[] {
  if (concept.risk === "evergreen" || !GOVERNED_REVIEW_STATUSES.has(concept.reviewStatus)) return [];
  const issues: ValidationIssue[] = [];
  const requiresDate = concept.risk === "time-sensitive" || concept.risk === "jurisdictional";
  if (requiresDate) {
    if (!concept.asOf?.trim())
      issues.push({ path: concept.id, message: `${concept.risk} concept requires asOf (PRD §7 provenance)` });
    if (!concept.reviewDue?.trim())
      issues.push({
        path: concept.id,
        message: `${concept.risk} concept requires a reviewDue date (PRD §7 provenance)`,
      });
  }
  if (concept.risk === "jurisdictional") {
    if (!concept.jurisdiction?.trim())
      issues.push({
        path: concept.id,
        message: "jurisdictional concept requires a named jurisdiction (PRD §7 provenance)",
      });
    if (concept.sourceIds.length === 0)
      issues.push({
        path: concept.id,
        message: "jurisdictional concept requires at least one source (PRD §7 provenance)",
      });
  }
  return issues;
}
