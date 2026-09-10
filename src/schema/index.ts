import type { Concept, Course, Exercise, Lesson } from "../domain";

export interface ValidationIssue {
  path: string;
  message: string;
}

function uniqueIssues(ids: string[], label: string): ValidationIssue[] {
  const seen = new Set<string>();
  const duplicate = ids.find((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  return duplicate ? [{ path: label, message: `Duplicate ID: ${duplicate}` }] : [];
}

const MATCH_PSEUDO_TERM_IDS = new Set(["sell", "put_u1intro"]);

function isKnownTermId(exercise: Exercise, id: string, conceptIds: Set<string>): boolean {
  return conceptIds.has(id) || (exercise.type === "match" && MATCH_PSEUDO_TERM_IDS.has(id));
}

function validateExercise(exercise: Exercise, conceptIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!exercise.id) issues.push({ path: "exercise", message: "Exercise ID is required" });
  if (!exercise.termIds?.length)
    issues.push({ path: exercise.id, message: "Exercise must reference at least one term" });
  exercise.termIds?.forEach((id) => {
    if (!isKnownTermId(exercise, id, conceptIds)) {
      issues.push({ path: exercise.id, message: `Unknown term reference: ${id}` });
    }
  });
  if (["meaning", "scenario"].includes(exercise.type)) {
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
  if (exercise.type === "match") {
    if (!exercise.pairs || exercise.pairs.length < 2) {
      issues.push({ path: exercise.id, message: "Match exercises need at least two pairs" });
    } else {
      const pairIds = exercise.pairs.map((pair) => pair.id);
      const duplicate = pairIds.find((id, index) => pairIds.indexOf(id) !== index);
      if (duplicate) issues.push({ path: exercise.id, message: `Duplicate match pair ID: ${duplicate}` });
      pairIds.forEach((id) => {
        if (!id || !isKnownTermId(exercise, id, conceptIds)) {
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

export function validateCourse(course: Course): ValidationIssue[] {
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
    concept.sourceIds.forEach((id) => {
      if (!sourceIds.has(id)) issues.push({ path: concept.id, message: `Unknown source: ${id}` });
    });
    issues.push(...conceptProvenanceIssues(concept));
  });
  allExercises.forEach((exercise) => {
    issues.push(...validateExercise(exercise, conceptIds));
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
// risk level relies on. Legacy content predates the rule and is grandfathered
// (its remediation debt is named in the PRD), so no id allowlist is needed.
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
