/**
 * What an answer sounds and feels like, for those who ask for it: two notes up for a right one, one
 * for a right one that needed help, two notes down for a miss, one low note for a wrong try that
 * leaves the question open, and a short buzz of the phone with each. Nothing is downloaded: the notes
 * are made by the browser. Both are off until the player turns them on.
 */
import type { Res } from './types';

/** How a question was settled, or `try`: a wrong answer with tries left. */
export type Cue = Res | 'try';

export interface Note {
  /** Hertz */
  f: number;
  /** Seconds after the first note starts. */
  at: number;
  /** Seconds it lasts. */
  len: number;
}

/** E5 and B5, a fifth up · D5 alone · B♭3 and F3, a fourth down · B♭3 alone. */
export const TONES: Record<Cue, readonly Note[]> = {
  ok: [
    { f: 659.25, at: 0, len: 0.1 },
    { f: 987.77, at: 0.09, len: 0.16 },
  ],
  warn: [{ f: 587.33, at: 0, len: 0.17 }],
  bad: [
    { f: 233.08, at: 0, len: 0.14 },
    { f: 174.61, at: 0.13, len: 0.22 },
  ],
  try: [{ f: 233.08, at: 0, len: 0.13 }],
};

/** Milliseconds on, off, on…: a tick for a right answer, two short buzzes for a miss, one for a wrong try. */
export const PULSES: Record<Cue, readonly number[]> = { ok: [12], warn: [24], bad: [45, 60, 45], try: [35] };

export interface FeedbackPrefs {
  sound: boolean;
  haptic: boolean;
}

/** What goes with an answer under these preferences: nothing at all when both are off. */
export function feedbackFor(res: Cue, prefs: FeedbackPrefs): { notes: readonly Note[]; pulse: readonly number[] } {
  return { notes: prefs.sound ? TONES[res] : [], pulse: prefs.haptic ? PULSES[res] : [] };
}

/** How long the notes of an answer take, in seconds. */
export const lengthOf = (notes: readonly Note[]): number => notes.reduce((end, n) => Math.max(end, n.at + n.len), 0);

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Make: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Make) return null;
  try {
    ctx ??= new Make();
    // Browsers hold the sound until the player has done something on the page.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Gets the sound ready. Called from a click or a key, which is when browsers allow it to start. */
export function prime(): void {
  audio();
}

const VOLUME = 0.09;

export function play(notes: readonly Note[]): void {
  if (!notes.length) return;
  const ac = audio();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + 0.015;
    for (const n of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = n.f;
      // In and out without a click: up in a hundredth of a second, then fading for as long as it lasts.
      gain.gain.setValueAtTime(0.0001, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(VOLUME, t0 + n.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.len + 0.03);
    }
  } catch {
    // Sound is an extra: a browser that will not play it changes nothing else.
  }
}

/** The device can vibrate and is one that is held in the hand. */
export function canBuzz(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

export function buzz(pulse: readonly number[]): void {
  if (!pulse.length || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate([...pulse]);
  } catch {
    // As with the sound.
  }
}

let lastAt = 0;

/** The sound and the buzz of an answer. Twice in the same instant counts as once. */
export function signal(res: Cue, prefs: FeedbackPrefs, now: number = Date.now()): boolean {
  if (!prefs.sound && !prefs.haptic) return false;
  if (now - lastAt < 60) return false;
  lastAt = now;
  const { notes, pulse } = feedbackFor(res, prefs);
  play(notes);
  buzz(pulse);
  return true;
}
