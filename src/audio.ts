/**
 * Pronunciation audio via the Web Speech API.
 *
 * Why runtime synthesis instead of recorded files: the fish.audio pipeline is
 * unreachable from this machine (API blocked at the network layer), and the
 * offline PWA promise argues for synthesis anyway — no files to precache, no
 * provider dependency, and en-US/en-GB accents come from the OS voice list for
 * free. The trade-off is voice quality varying by device; if recorded audio
 * lands later, the speak() signature is the seam to swap.
 *
 * Two facts from the headless probe that shape this module:
 *  - getVoices() starts empty and fills asynchronously; callers must wait for
 *    voiceschanged (or poll) before trusting the list.
 *  - speak() is rejected without user activation ("not-allowed"). Every entry
 *    point here runs behind a click (starting a lesson, tapping a button), which
 *    satisfies the gesture requirement.
 *
 * Voice picking is a pure function so it can be tested under Node; the browser
 * wrapper below is the only part that touches speechSynthesis.
 */

export type Accent = "en-US" | "en-GB";

export interface VoiceInfo {
  name: string;
  lang: string;
  /** Platform-default voices rank first; they sound the least synthetic. */
  default?: boolean;
  localService?: boolean;
}

/**
 * Pick the best voice for an accent.
 *
 * Order: exact lang match → same language prefix → anything English. Within a
 * tier, platform-default voices win (they are the ones users have actually
 * heard on their device), then local (offline) voices, then alphabetical for
 * determinism in tests.
 */
export function pickVoice(voices: VoiceInfo[], accent: Accent): VoiceInfo | undefined {
  const english = voices.filter((voice) => /^en/i.test(voice.lang));
  if (!english.length) return undefined;
  const tier = (voice: VoiceInfo) => {
    if (voice.lang.replace("_", "-") === accent) return 0;
    if (voice.lang.slice(0, 2).toLowerCase() === accent.slice(0, 2)) return 1;
    return 2;
  };
  const rank = (voice: VoiceInfo) =>
    tier(voice) * 100 + (voice.default ? 0 : 10) + (voice.localService === false ? 5 : 0);
  return [...english].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))[0];
}

/**
 * Wait until the browser has a voice list. getVoices() is empty on first call
 * on some platforms; voiceschanged fires when the list is ready, but has been
 * observed not to fire in every browser either, so poll as a backstop.
 */
export async function waitForVoices(timeoutMs = 2_000): Promise<VoiceInfo[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const synth = window.speechSynthesis;
  const read = (): VoiceInfo[] =>
    synth.getVoices().map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      default: voice.default,
      localService: voice.localService,
    }));
  const first = read();
  if (first.length) return first;
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      clearInterval(poll);
      clearTimeout(giveUp);
      resolve(read());
    };
    const poll = setInterval(() => {
      if (synth.getVoices().length) done();
    }, 200);
    const giveUp = setTimeout(done, timeoutMs);
    synth.addEventListener("voiceschanged", done);
  });
}

let chosen: { accent: Accent; voice: VoiceInfo | undefined } | undefined;

/** Resolve and cache the voice for an accent. Cached because getVoices is not free. */
async function voiceFor(accent: Accent): Promise<VoiceInfo | undefined> {
  if (chosen?.accent === accent) return chosen.voice;
  const voices = await waitForVoices();
  const voice = pickVoice(voices, accent);
  chosen = { accent, voice };
  return voice;
}

export interface SpeakOptions {
  accent?: Accent;
  /** 1 is normal; slightly slow helps learners parse a word's syllables. */
  rate?: number;
}

/**
 * Speak text and resolve when finished. Resolves false when synthesis could not
 * start (no voices, blocked by autoplay policy) so callers can hide buttons
 * rather than leave a control that does nothing.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<boolean> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  const voice = await voiceFor(options.accent ?? "en-US");
  if (!voice) return false;
  // Cancel any utterance still playing: tapping the speaker twice should
  // restart the word, not queue a second copy behind the first.
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = null; // matched by name below; see note
  // Setting .voice by object reference works, but matching by name is what
  // survives across the async voice list reload on some platforms.
  const voices = synth.getVoices();
  const match = voices.find((candidate) => candidate.name === voice.name);
  if (match) utterance.voice = match;
  utterance.lang = voice.lang;
  utterance.rate = options.rate ?? 0.9;
  return new Promise((resolve) => {
    const settled = (ok: boolean) => {
      utterance.onend = null;
      utterance.onerror = null;
      clearTimeout(guard);
      resolve(ok);
    };
    utterance.onend = () => settled(true);
    utterance.onerror = () => settled(false);
    const guard = setTimeout(() => settled(false), 15_000);
    synth.speak(utterance);
  });
}
