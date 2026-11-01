interface LocalizedAudit {
  claim: string;
  stem: string;
  options: string[];
  answer: number;
  why: string;
}
interface BilingualAudit {
  zh: LocalizedAudit;
  en: LocalizedAudit;
}
export const AUDITS: Record<string, BilingualAudit>;
export const AUDIT_REVIEWS: (BilingualAudit & {
  id: string;
  unit: number;
  termIds: string[];
})[];
