import { CornerDownLeft } from 'lucide-react';
import { L } from '../lib/i18n';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '../lib/text';

export interface Suggestion {
  id: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
}

interface Props {
  placeholder: string;
  /** Called with the text on Enter (or with a suggestion's label when one is chosen). */
  onSubmit(text: string): void;
  /** Called on every keystroke; return true to take the text as an answer and clear the field. */
  onType?(text: string): boolean;
  suggest?(text: string): Suggestion[];
  disabled?: boolean;
  /** Increase to shake the field (wrong answer). */
  shake?: number;
  /** Increase to empty the field. */
  clear?: number;
  /** Shows that Enter is needed to confirm what is typed. */
  pending?: boolean;
  autoFocus?: boolean;
  label: string;
}

export function AnswerInput({ placeholder, onSubmit, onType, suggest, disabled, shake = 0, clear = 0, pending, autoFocus = true, label }: Props) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const listId = useId();

  useEffect(() => {
    setText('');
    setActive(-1);
  }, [clear]);

  useEffect(() => {
    if (!shake) return;
    setShaking(true);
    // The wrong text stays, selected: typing replaces it and a slip of the finger can still be mended.
    input.current?.select();
    const t = setTimeout(() => setShaking(false), 420);
    return () => clearTimeout(t);
  }, [shake]);

  useEffect(() => {
    if (autoFocus && !disabled) input.current?.focus({ preventScroll: true });
  }, [autoFocus, disabled, clear]);

  const options = open && suggest && text.trim() ? suggest(text) : [];
  const listed = options.length > 0;

  // The list is laid over the page from the field's place on screen, so that a short or scrolling
  // panel cannot cut it off (on a phone it opens over the map, above the keyboard).
  useLayoutEffect(() => {
    if (!listed) return;
    const update = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const view = window.visualViewport?.height ?? window.innerHeight;
      setPlace({ left: r.left, top: r.bottom + 6, width: r.width, maxHeight: Math.max(96, view - r.bottom - 14) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [listed]);

  const submit = (value: string) => {
    if (!value.trim()) return;
    setOpen(false);
    setActive(-1);
    onSubmit(value);
  };

  return (
    <div className={cx('answer', shaking && 'shake')} ref={box}>
      <input
        ref={input}
        className="answer-input"
        type="text"
        value={text}
        placeholder={placeholder}
        aria-label={label}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        role={suggest ? 'combobox' : undefined}
        aria-expanded={suggest ? options.length > 0 : undefined}
        aria-controls={suggest ? listId : undefined}
        aria-autocomplete={suggest ? 'list' : undefined}
        onChange={(e) => {
          // No answer begins with a dot or a space: the last one of "N.H." comes after "N.H" has been taken.
          const v = e.target.value.replace(/^[\s.]+/, '');
          if (onType?.(v)) {
            setText('');
            setOpen(false);
          } else {
            setText(v);
            setOpen(true);
          }
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            submit(active >= 0 && options[active] ? options[active].label : text);
          } else if (e.key === 'ArrowDown' && options.length) {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === 'ArrowUp' && options.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button type="button" className={cx('answer-send', pending && 'pending')} onClick={() => submit(text)} disabled={disabled || !text.trim()} aria-label={L('Enviar respuesta', 'Send answer')} title={L('Enviar (Intro)', 'Send (Enter)')}>
        <CornerDownLeft size={18} />
      </button>
      {listed && place && (
        <ul className="answer-list" id={listId} role="listbox" style={place}>
          {options.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={cx(i === active && 'on')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  submit(o.label);
                  input.current?.focus({ preventScroll: true });
                }}
              >
                {o.icon}
                <span>{o.label}</span>
                {o.sub && <small>{o.sub}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
