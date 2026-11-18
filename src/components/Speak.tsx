/** Says a name aloud with the voice of the browser. Nothing is downloaded and nothing leaves the device. */
import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { L, getLang } from '../lib/i18n';
import { cx } from '../lib/text';

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

/** The voice for a language tag: the exact one when the device has it, or any of the same language. */
function voiceFor(tag: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const two = tag.slice(0, 2).toLowerCase();
  const same = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => same(v) === tag.toLowerCase()) ?? voices.find((v) => same(v).slice(0, 2) === two);
}

/**
 * Speaks a text with a voice of the language of the interface, which is the language the names are
 * written in. Names that are kept in their own language (Bouches-du-Rhône, Baden-Württemberg) are read by
 * that same voice, with its accent: the app does not know which language each name is in.
 */
export function speak(text: string, onEnd?: () => void): void {
  if (!canSpeak()) return onEnd?.();
  const synth = window.speechSynthesis;
  // One name at a time: the loudspeaker of another name takes the voice instead of waiting for its turn.
  synth.cancel();
  const said = new window.SpeechSynthesisUtterance(text);
  const tag = getLang() === 'en' ? 'en-GB' : 'es-ES';
  said.lang = tag;
  const voice = voiceFor(tag);
  if (voice) said.voice = voice;
  said.rate = 0.9;
  said.onend = () => onEnd?.();
  said.onerror = () => onEnd?.();
  synth.speak(said);
}

/** Stops whatever is being said: a name must not go on sounding after its question has gone. */
export function hush(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/**
 * The loudspeaker next to a name. It is a switch: on while the name is being said (`aria-pressed`, so that a
 * screen reader says it too), and pressing it then stops the voice. With `label` it is a button with words
 * on it, for where the voice is all there is to go by; `secret` keeps the name out of what it says of itself.
 */
export function SpeakButton({ text, className, label, secret }: { text: string; className?: string; label?: string; secret?: boolean }) {
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);
  /** Which time of saying it is the current one: the end of an earlier one must not switch this one off. */
  const turn = useRef(0);
  // Whatever is being said stops when the button goes away with its question.
  useEffect(
    () => () => {
      turn.current++;
      clearTimeout(timer.current);
      if (canSpeak()) window.speechSynthesis.cancel();
    },
    [],
  );
  if (!canSpeak()) return null;

  const stop = () => {
    turn.current++;
    clearTimeout(timer.current);
    window.speechSynthesis.cancel();
    setBusy(false);
  };
  const start = () => {
    const mine = ++turn.current;
    const done = () => {
      if (turn.current !== mine) return;
      clearTimeout(timer.current);
      setBusy(false);
    };
    setBusy(true);
    speak(text, done);
    // A device without a voice for the language never says it has finished: the button must not stay lit.
    clearTimeout(timer.current);
    timer.current = window.setTimeout(done, 6000);
  };

  return (
    <button
      type="button"
      className={cx('speak', busy && 'on', label && 'speak-wide', className)}
      aria-label={label ? undefined : secret ? L('Escuchar el nombre', 'Listen to the name') : L(`Escuchar «${text}»`, `Listen to “${text}”`)}
      aria-pressed={busy}
      title={busy ? L('Sonando: pulsa para parar', 'Playing: press to stop') : L('Escuchar el nombre', 'Listen to the name')}
      onClick={(e) => {
        e.stopPropagation();
        if (busy) stop();
        else start();
      }}
    >
      <Volume2 size={label ? 20 : 16} aria-hidden="true" />
      {label && <span>{label}</span>}
    </button>
  );
}
