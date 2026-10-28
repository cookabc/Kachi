import { describe, expect, it } from "vitest";
import { ipaFor } from "./ipa";

// The IPA table is generated from the CMU dictionary by
// scripts/build-ipa.mjs. These assertions pin the three rules that were wrong
// in the first draft — each was caught by eyeballing the output, not by a test,
// which is exactly why they are pinned now.
describe("IPA transcription", () => {
  it("places stress at the syllable start, not before the vowel", () => {
    // The naive "prefix the vowel" version produced /rˈæli/.
    expect(ipaFor("rally")).toBe("/ˈræli/");
    expect(ipaFor("hedge")).toBe("/ˈhɛdʒ/");
  });

  it("treats unstressed AH as schwa", () => {
    // AH0 is ə; AH1/AH2 are ʌ. Without the distinction supply came out /sʌplˈaɪ/.
    expect(ipaFor("supply")).toBe("/səˈplaɪ/");
    expect(ipaFor("demand")).toBe("/dɪˈmænd/");
  });

  it("does not double the vowel after an r-coloured syllable", () => {
    // CMU writes collateral as ... T ER0 AH0 L; emitting both gave /kʌlˈætɝʌl/.
    expect(ipaFor("collateral")).toBe("/kəˈlætɝəl/");
  });

  it("covers abbreviations from the manual table, not by guessing", () => {
    // The dictionary has no p/e; the script adds it from a table where every
    // entry is verifiable from the word itself (letter names, compounds).
    expect(ipaFor("p/e")).toBe("/ˌpi ˈi/");
    expect(ipaFor("capex")).toBe("/ˈkæpɛks/");
    expect(ipaFor("backtest")).toBe("/ˈbæktɛst/");
  });

  it("returns undefined for ids that are not in the table at all", () => {
    // Callers must render nothing rather than invent a transcription.
    expect(ipaFor("not-a-concept")).toBeUndefined();
  });
});
