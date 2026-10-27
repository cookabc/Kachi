import { describe, expect, it } from "vitest";
import outOfSyllabus from "../content/out-of-syllabus.json";
import { course } from "./course";
import { OUT_OF_SYLLABUS_ART } from "./out-of-syllabus";
import { validateCourse } from "./schema";

// The whitelist of "art but not a concept" ids exists twice on purpose: the app
// imports a tiny leaf module (bundled), and the build-time validator reads JSON
// (plain Node cannot resolve extensionless TS imports). Two copies drift unless
// something checks — this is that check.
describe("out-of-syllabus ids stay in sync", () => {
  it("the leaf module and the JSON data file list the same ids", () => {
    expect([...OUT_OF_SYLLABUS_ART].sort()).toEqual([...outOfSyllabus.ids].sort());
  });

  it("no published concept is listed as out-of-syllabus", () => {
    // A concept that also sat in the whitelist would be exempt from the
    // reference check that keeps stray ids out of the content.
    const conceptIds = new Set(course.concepts.map((concept) => concept.id));
    const overlap = [...OUT_OF_SYLLABUS_ART].filter((id) => conceptIds.has(id));
    expect(overlap).toEqual([]);
  });

  it("rejects an id that is neither a concept nor declared", () => {
    const broken = structuredClone(course) as typeof course;
    broken.lessons[0].prompts[0].termIds = ["not-a-real-term"];
    const issues = validateCourse(broken, OUT_OF_SYLLABUS_ART);
    expect(issues.some((issue) => /Unknown term reference: not-a-real-term/.test(issue.message))).toBe(true);
  });
});
