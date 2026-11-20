/**
 * Alphabet: a country for each letter, each with a clue, typed one after another; a letter can be passed
 * and comes round again. A game with no map, in a file of its own that is fetched when it is played. What
 * is asked is made in lib/alphabet.ts.
 */
import { ArrowRight, Flag as FlagIcon, SkipForward, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { BASE } from '../components/ui';
import { makeAlphabet, type AlphaQuestion, type AlphaWorld } from '../lib/alphabet';
import { countryAnswers, countryItem } from '../lib/data';
import { L, getLang, nm } from '../lib/i18n';
import { Matcher, shortNote } from '../lib/matcher';
import { modeNameIn } from '../lib/modes';
import { useStore, type GameConfig } from '../lib/store';
import { cx, fold, initialOf, nf } from '../lib/text';
import type { Country } from '../lib/types';
import { GameShell, Hud, Results, Verdict, answered, useElapsed, type ResultRow } from './common';
import './alphabet.css';

/** How a letter stands: answered right, answered wrong, or still to be answered. */
type Mark = 'ok' | 'bad';

/** What can be typed instead of a country to leave the letter for later. */
const PASS_WORDS: readonly string[] = ['paso', 'pass'];

export function AlphabetGame({ countries, world, cfg, onExit }: { countries: Country[]; world: AlphaWorld; cfg: GameConfig; onExit(): void }) {
  const title = modeNameIn(cfg.section, 'alphabet');
  const what = `${nf(countries.length)} ${L('países', 'countries')}`;
  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const matcher = useMemo(() => new Matcher(countries.map(countryAnswers)), [countries]);
  const [questions, setQuestions] = useState<AlphaQuestion[]>(() => makeAlphabet(countries, world));
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  /** The letter in hand. */
  const [at, setAt] = useState(0);
  /** The letter in hand has been missed, and is there to be read: what was typed instead, if anything was. */
  const [done, setDone] = useState<{ typed?: string } | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  /** Why what was typed is no answer. */
  const [note, setNote] = useState<string | null>(null);
  /** The letter just answered right, and its country: said while the next one is on the table. */
  const [last, setLast] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [ended, setEnded] = useState(false);
  const addSession = useStore((s) => s.addSession);
  const ms = useElapsed(!ended);

  const q = questions[at] as AlphaQuestion | undefined;
  const settled = Object.keys(marks).length;
  /** The letters still to be answered, from the one after the one in hand and round again. */
  const pending = questions.map((_, i) => (at + 1 + i) % questions.length).filter((i) => i !== at && !marks[questions[i].letter]);
  const nameOf = (id: string): string => {
    const c = byId.get(id);
    return c ? nm(c.n) : id;
  };
  /** The country asked, as the verdict and the results show it: the same one while the letter is in hand. */
  const item = useMemo(() => {
    const c = q && byId.get(q.id);
    return c ? countryItem(c) : null;
  }, [q, byId]);

  const finish = (all = rows) => {
    const ok = all.filter((r) => r.res === 'ok').length;
    if (all.length) addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: what, total: all.length, ok, warn: 0, bad: all.length - ok, ms });
    setEnded(true);
  };

  /** The letter in hand is answered, right or wrong; what the results will say of it. */
  const settle = (res: Mark): ResultRow[] => {
    if (!q || !item) return rows;
    const all = [...rows, { item, res, note: `${q.letter} · ${q.flag ? L('por su bandera', 'by its flag') : q.text}` }];
    setMarks((m) => ({ ...m, [q.letter]: res }));
    setRows(all);
    setNote(null);
    return all;
  };

  /** The letter is left for later: on to the next one that is still to be answered. */
  const pass = () => {
    if (!q || done || !pending.length) return;
    setAt(pending[0]);
    setNote(null);
    setLast(null);
    setClear((n) => n + 1);
  };

  const onSubmit = (text: string) => {
    if (!q || done) return;
    if (PASS_WORDS.includes(fold(text).trim())) {
      // With no other letter to go to, there is nothing to pass to.
      if (pending.length) return pass();
      setShake((n) => n + 1);
      return setNote(L('Es la última letra: ya no se puede pasar.', 'It is the last letter: there is no passing now.'));
    }
    const verdict = matcher.check(text, q.id);
    if (verdict.res === 'yes') {
      // A right answer moves on by itself: the next letter is there to be typed at once.
      const all = settle('ok');
      answered('ok');
      setLast(`${q.letter} · ${nameOf(q.id)}`);
      setClear((n) => n + 1);
      if (!pending.length) return finish(all);
      return setAt(pending[0]);
    }
    if (verdict.res === 'other') {
      const other = byId.get(verdict.id);
      // A country of another letter is a slip, not an answer.
      if (other && initialOf(nm(other.n)) !== q.letter) {
        setShake((n) => n + 1);
        return setNote(L(`${nm(other.n)} no empieza por ${q.letter}.`, `${nm(other.n)} does not begin with ${q.letter}.`));
      }
      settle('bad');
      setLast(null);
      return setDone({ typed: nameOf(verdict.id) });
    }
    // What names no country of the selection is not an answer either: it can be typed again.
    setShake((n) => n + 1);
    setNote(verdict.res === 'vague' || verdict.res === 'short' ? shortNote('vague', text) : L('Ese país no está en tu selección.', 'That country is not in your selection.'));
  };

  /** "I don't know": the letter is given up, and its country shown. */
  const giveUp = () => {
    if (!q || done) return;
    settle('bad');
    setLast(null);
    setDone({});
  };

  const next = () => {
    if (!done) return;
    if (!pending.length) return finish();
    setAt(pending[0]);
    setDone(null);
    setClear((n) => n + 1);
  };

  /**
   * Only the countries of the letter are offered, in the order of the alphabet: no other is an answer. And
   * without their flags, which would say whose the flag of the clue is.
   */
  const suggest =
    cfg.opts.suggest && q && !done
      ? (text: string): Suggestion[] =>
          matcher
            .suggest(text, countries.length)
            .map((id) => byId.get(id)!)
            .filter((c) => initialOf(nm(c.n)) === q.letter)
            .map((c) => ({ id: c.id, label: nm(c.n) }))
            .sort((a, b) => a.label.localeCompare(b.label, getLang()))
            .slice(0, 6)
      : undefined;

  if (ended || !q) {
    const ok = rows.filter((r) => r.res === 'ok').length;
    const left = questions.filter((x) => !marks[x.letter]);
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        panel={
          <div className="pop">
            <Results
              title={!questions.length ? L('Sin letras', 'No letters') : !left.length && ok === questions.length ? L('¡De la A a la Z!', 'From A to Z!') : !left.length ? L('Alfabeto terminado', 'Alphabet done') : L('Partida terminada', 'Game over')}
              rows={rows}
              ms={ms}
              note={
                !questions.length
                  ? L('Con estos países no sale ninguna letra: elige más.', 'These countries give no letter to ask: choose more of them.')
                  : left.length
                    ? L(`Sin responder: ${left.map((x) => x.letter).join(', ')}.`, `Not answered: ${left.map((x) => x.letter).join(', ')}.`)
                    : undefined
              }
              again={questions.length > 0}
              // The last letter is often typed: the Enter that follows must not start another game.
              focus={false}
              onAgain={() => {
                setQuestions(makeAlphabet(countries, world));
                setMarks({});
                setAt(0);
                setDone(null);
                setRows([]);
                setNote(null);
                setLast(null);
                setClear((n) => n + 1);
                setEnded(false);
              }}
              onExit={onExit}
            />
          </div>
        }
      />
    );
  }

  const said = (mark: Mark | undefined, now: boolean): string => (mark === 'ok' ? L('acertada', 'right') : mark === 'bad' ? L('fallada', 'wrong') : now ? L('la que toca', 'in hand') : L('pendiente', 'to come'));
  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={questions.length ? settled / questions.length : undefined}
      hud={<Hud ms={ms} progress={`${settled} / ${questions.length}`} />}
      panel={
        <div className="pop tf alpha">
          <ol className="alpha-strip" aria-label={L('Las letras', 'The letters')}>
            {questions.map((x, i) => (
              <li key={x.letter} className={cx(marks[x.letter] && `is-${marks[x.letter]}`, i === at && 'now')} aria-current={i === at ? 'step' : undefined}>
                <span aria-hidden="true">{x.letter}</span>
                <span className="sr-only">{`${x.letter}: ${said(marks[x.letter], i === at)}`}</span>
              </li>
            ))}
          </ol>
          <p className="kicker center alpha-with">
            {L('Con la', 'With')} <b>{q.letter}</b>
          </p>
          {q.flag && <img className="alpha-flag" src={`${BASE}flags/${q.flag}.svg`} alt="" draggable={false} />}
          <h2 className="q-ask center alpha-clue">{q.text}</h2>
          {!done ? (
            <>
              <AnswerInput
                label={L(`País que empieza por ${q.letter}`, `Country that begins with ${q.letter}`)}
                placeholder={L(`Empieza por ${q.letter}…`, `Begins with ${q.letter}…`)}
                onSubmit={onSubmit}
                suggest={suggest}
                shake={shake}
                clear={clear}
              />
              <p className={cx('q-note', !note && last && 'alpha-right')} role="status">
                {note ??
                  (last
                    ? L(`¡Correcto! ${last}.`, `Correct! ${last}.`)
                    : pending.length
                      ? L('Un intento por letra. Si dudas, pasa: la letra vuelve después.', 'One try for each letter. If in doubt, pass: the letter comes round again later.')
                      : L('Un intento, y es la última letra.', 'One try, and it is the last letter.'))}
              </p>
            </>
          ) : (
            <Verdict
              res="bad"
              item={item}
              wiki={cfg.opts.wiki}
              title={
                <>
                  {L('Era', 'It was')} <b>{nameOf(q.id)}</b>
                </>
              }
              lead={done.typed ? <p className="tf-why">{L(`Has escrito ${done.typed}.`, `You typed ${done.typed}.`)}</p> : undefined}
            />
          )}
          <div className="q-actions center">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={next} autoFocus>
                {pending.length ? L('Siguiente', 'Next') : L('Ver resultado', 'See the result')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={pass} disabled={!pending.length}>
                  <SkipForward size={15} aria-hidden="true" />
                  {L('Paso', 'Pass')}
                </button>
                <button type="button" className="btn btn-sm" onClick={giveUp}>
                  <X size={15} aria-hidden="true" />
                  {L('No lo sé', "I don't know")}
                </button>
              </>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish()}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}
