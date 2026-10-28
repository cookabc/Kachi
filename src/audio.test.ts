import { describe, expect, it } from "vitest";
import { pickVoice, type VoiceInfo } from "./audio";

// Voice picking is pure so it can be tested without a browser. The ranking
// encodes one product decision: the platform-default voice beats third-party
// ones, because it is the voice the user has actually heard on their device.
const voice = (name: string, lang: string, extra: Partial<VoiceInfo> = {}): VoiceInfo => ({
  name,
  lang,
  ...extra,
});

describe("pickVoice", () => {
  const voices = [
    voice("Google UK English Female", "en-GB", { localService: false }),
    voice("Samantha", "en-US", { default: true, localService: true }),
    voice("Ting-Ting", "zh-CN"),
    voice("Karen", "en-AU", { default: true, localService: true }),
    voice("Daniel", "en-GB", { default: true, localService: true }),
  ];

  it("prefers an exact locale match", () => {
    expect(pickVoice(voices, "en-US")?.name).toBe("Samantha");
    expect(pickVoice(voices, "en-GB")?.name).toBe("Daniel");
  });

  it("treats underscore and hyphen locale forms as equivalent", () => {
    // macOS historically reports en_US; the accent constants use en-US.
    expect(pickVoice([voice("Alex", "en_US")], "en-US")?.name).toBe("Alex");
  });

  it("falls back to any English voice when the accent is absent", () => {
    const gb = voices.filter((v) => v.lang !== "en-GB" && v.lang !== "en_US");
    expect(pickVoice(gb, "en-GB")?.lang.startsWith("en")).toBe(true);
  });

  it("ranks platform-default voices above non-default ones in the same tier", () => {
    const tied = [voice("Zira", "en-US", { localService: false }), voice("Ava", "en-US", { default: true })];
    expect(pickVoice(tied, "en-US")?.name).toBe("Ava");
  });

  it("returns undefined when there are no English voices", () => {
    expect(pickVoice([voice("Ting-Ting", "zh-CN")], "en-US")).toBeUndefined();
    expect(pickVoice([], "en-US")).toBeUndefined();
  });

  it("is deterministic for equal-ranked voices", () => {
    const tied = [voice("B", "en-US"), voice("A", "en-US")];
    expect(pickVoice(tied, "en-US")?.name).toBe("A");
  });
});
