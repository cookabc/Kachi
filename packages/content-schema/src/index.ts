import type { Course, Exercise } from "@kachi/domain";

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

function validateExercise(exercise: Exercise, conceptIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!exercise.id) issues.push({ path: "exercise", message: "Exercise ID is required" });
  if (!exercise.termIds?.length) issues.push({ path: exercise.id, message: "Exercise must reference at least one term" });
  exercise.termIds?.forEach((id) => {
    if (!conceptIds.has(id) && !id.endsWith("_u1intro") && id !== "sell") {
      issues.push({ path: exercise.id, message: `Unknown term reference: ${id}` });
    }
  });
  if (["meaning", "scenario"].includes(exercise.type) && (!exercise.options || typeof exercise.answer !== "number")) {
    issues.push({ path: exercise.id, message: "Choice exercises need options and a numeric answer" });
  }
  if (exercise.type === "fill" && (!exercise.bank || typeof exercise.answer !== "string")) {
    issues.push({ path: exercise.id, message: "Fill exercises need a bank and text answer" });
  }
  if (exercise.type === "match" && (!exercise.pairs || exercise.pairs.length < 2)) {
    issues.push({ path: exercise.id, message: "Match exercises need at least two pairs" });
  }
  return issues;
}

export function validateCourse(course: Course): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (course.schemaVersion !== 1) issues.push({ path: "schemaVersion", message: "Unsupported schema version" });
  if (!course.packId || !course.contentVersion || !course.locale) {
    issues.push({ path: "manifest", message: "packId, contentVersion, and locale are required" });
  }

  issues.push(...uniqueIssues(course.units.map((unit) => String(unit.id)), "units"));
  issues.push(...uniqueIssues(course.concepts.map((concept) => concept.id), "concepts"));
  issues.push(...uniqueIssues(course.lessons.map((lesson) => lesson.id), "lessons"));
  const conceptIds = new Set(course.concepts.map((concept) => concept.id));
  const sourceIds = new Set(course.sources.map((source) => source.id));
  const allExercises = course.lessons.flatMap((lesson) => lesson.prompts);
  issues.push(...uniqueIssues(allExercises.map((exercise) => exercise.id), "exercises"));

  course.concepts.forEach((concept) => {
    if (!concept.mixUp || !conceptIds.has(concept.mixUp)) {
      issues.push({ path: concept.id, message: `Unknown mix-up concept: ${concept.mixUp}` });
    }
    concept.sourceIds.forEach((id) => {
      if (!sourceIds.has(id)) issues.push({ path: concept.id, message: `Unknown source: ${id}` });
    });
  });
  allExercises.forEach((exercise) => issues.push(...validateExercise(exercise, conceptIds)));
  return issues;
}
