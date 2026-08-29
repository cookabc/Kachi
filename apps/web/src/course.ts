import type { Course } from "@kachi/domain";
import zhCourse from "../../../content/packs/hedge-or-pledge/zh-CN/course.json";
import enCourse from "../../../content/packs/hedge-or-pledge/en-US/course.json";

export type Lang = "zh-CN" | "en-US";

const packs: Record<Lang, Course> = {
  "zh-CN": zhCourse as Course,
  "en-US": enCourse as Course
};

/** Default pack — zh-CN. Tests and legacy call sites read this. */
export const course: Course = packs["zh-CN"];

export function courseFor(lang: Lang): Course {
  return packs[lang];
}
