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
  // One name at a time: a second click starts over instead of queueing.
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

export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);
  // Whatever is being said stops when the button goes away with its question.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (canSpeak()) window.speechSynthesis.cancel();
    },
    [],
  );
  if (!canSpeak()) return null;
  const label = L(`Escuchar «${text}»`, `Listen to “${text}”`);
  return (
    <button
      type="button"
      className={cx('speak', busy && 'on', className)}
      aria-label={label}
      title={L('Escuchar el nombre', 'Listen to the name')}
      onClick={(e) => {
        e.stopPropagation();
        setBusy(true);
        speak(text, () => setBusy(false));
        // A device without a voice for the language never says it has finished: the button must not stay lit.
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setBusy(false), 6000);
      }}
    >
      <Volume2 size={16} aria-hidden="true" />
    </button>
  );
}
