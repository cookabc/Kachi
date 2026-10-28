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

  it("returns undefined for terms the dictionary does not list", () => {
    // Abbreviations are absent on purpose — a guessed transcription is worse
    // than none. Callers must render nothing rather than an invented string.
    expect(ipaFor("p/e")).toBeUndefined();
    expect(ipaFor("not-a-concept")).toBeUndefined();
  });
});
