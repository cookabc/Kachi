import raw from "../../content/packs/hedge-or-pledge/zh-CN/course.json";
import type { Course } from "../domain";

/** The hand-written Chinese course used by behavioral tests. */
export const authoredCourse = raw as unknown as Course;
