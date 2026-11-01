/**
 * Tiny answer sounds, synthesized with WebAudio — no files to ship or precache.
 *
 * A correct answer plays a rising two-note chime; a miss plays one soft low
 * note, never a buzzer: the product treats a miss as information, not failure.
 * Sounds follow the effects level — at 0 they are off, like the animations.
 */
let context: AudioContext | undefined;

function audio(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function note(ctx: AudioContext, frequency: number, start: number, length: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export function playAnswerSound(correct: boolean, level: number): void {
  if (level <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  const volume = 0.12 * Math.min(1, level / 100);
  const now = ctx.currentTime;
  if (correct) {
    note(ctx, 659.25, now, 0.16, volume); // E5
    note(ctx, 987.77, now + 0.09, 0.26, volume); // B5
  } else {
    note(ctx, 196, now, 0.28, volume * 0.9); // G3
  }
}

export function playCompleteSound(level: number): void {
  if (level <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  const volume = 0.1 * Math.min(1, level / 100);
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    note(ctx, frequency, now + index * 0.08, 0.32, volume);
  });
}
