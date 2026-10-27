/**
 * The headline drill source is plain .mjs so the generator (node, no TS) and
 * the tests can both read it. This declares its shape for the TypeScript side.
 */
export interface HeadlineDrillSource {
  id: string;
  a: string;
  b: string;
  text: string;
  answer: string;
  why: string;
  whyEn?: string;
}

export const HEADLINE_DRILLS: readonly HeadlineDrillSource[];
