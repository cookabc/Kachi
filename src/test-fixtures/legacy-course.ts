import raw from "../../content/packs/hedge-or-pledge/zh-CN/course.json";
import type { Course } from "../domain";

/**
 * The hand-written hedge-or-pledge pack, Chinese locale. It used to be the
 * default course and many unit tests were written against its exact ids
 * (hedge, pledge, collateral…). The default is now level 1, so those tests
 * import this fixture explicitly instead of relying on whatever `course`
 * happens to point at.
 */
export const legacyCourse = raw as unknown as Course;
