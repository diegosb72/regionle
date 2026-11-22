/**
 * Question-by-question games: pin on the map (by its written name or by ear), jigsaw, identify, outline,
 * capitals, flags, what each piece belongs to, and the medley that deals the others by turns.
 */
import { ArrowRight, ChevronDown, Flag as FlagIcon, Heart, Lightbulb, MapPin, Timer } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { ChallengeBox } from '../components/ChallengeBox';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { SpeakButton, canSpeak, hush, speak } from '../components/Speak';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { datedName, datedNote, keepDated, type Kept } from '../lib/dated';
import { namesKept, namesShown, otherOf, tally, verdictOf, whoOf, type Who } from '../lib/duo';
import { useDuoCode } from '../lib/duoLazy';
import { useTaskCode } from '../lib/taskLazy';
import { silhouette } from '../lib/geo';
import type { Ghost } from '../lib/ghost';
import { anyGhost, ghostable, useGhostCode } from '../lib/ghostLazy';
import { halve, hintKinds, hintLabel, hintOf, type Hint, type HintAsk, type HintKind } from '../lib/hints';
import { L, nm } from '../lib/i18n';
import { timesMixed } from '../lib/mix';
import { MODE_NAME, formatName } from '../lib/modes';
import { clockPaused, usePaused } from '../lib/pause';
import { evenOf, formatOfGame } from '../lib/rules';
import { clockText, customRules, recordName, rulesOfGame, rulesText } from '../lib/ruleset';
import { isDated, useStore, type FlagLook, type Format, type Skill } from '../lib/store';
import { Matcher, shortNote } from '../lib/matcher';
import type { Places } from '../lib/sets';
import { cx, fmtTime, hintMax, letterHint, mulberry32, nf, sample, shuffle, type Answerable } from '../lib/text';
import { capitalAnswers } from '../lib/typeins';
import type { Belongs, Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, answered, nearest, originOf, showsCountry, useClock, type GameProps, type ResultRow } from './common';
import type { GhostEnd } from './Ghost';
import { FLAG_BLUR, answersItself, askOf, asksFor, belongsItself, capitalsNeedTyping, gradeOf, initQuiz, quizReducer, scoreOf, turnOf } from './quiz';
import './quiz.css';

/** The ways a question is asked. */
type QuizMode = 'pin' | 'puzzle' | 'identify' | 'outline' | 'capital' | 'flag' | 'parent';
/** What the menus call the game: one of those ways, the medley of them, or "pin it" by ear. */
type QuizId = QuizMode | 'mix' | 'listen';

/** What each game teaches, for the review. What a piece belongs to is not reviewed: it is played and that is all. */
const SKILL: Partial<Record<QuizMode, Skill>> = { pin: 'loc', puzzle: 'loc', identify: 'name', outline: 'name', capital: 'cap', flag: 'flag' };

/** A question nobody has asked for help with. */
const NO_HELP = { main: 0, used: [], said: [], cut: [], open: false };
/** What makes a game a challenge with a date, taken away: what is left is a game like any other. */
const UNDATED = { challenge: undefined, weekly: undefined, zone: undefined, occasion: undefined };
/** …and what makes it a game against its ghost (lib/ghost.ts). */
const NO_GHOST = { ghost: undefined };

/** `places` names the parts of the world: what a hint says a country is in. */
export function QuizGame({ deck, cfg, onExit, onAgain, places }: GameProps & { places?: Places }) {
  const game = cfg.mode as QuizId;
  /** A medley: every piece is asked about in a way of its own, drawn by lot. */
  const medley = game === 'mix';
  /** By ear: the name is said aloud, not written. */
  const byEar = game === 'listen';
  /** …where there is a voice to say it: without one the name is read, as in "pin it". */
  const voiced = byEar && canSpeak();
  /** The one way a game asks, when it has one. */
  const fixed: QuizMode | null = medley ? null : byEar ? 'pin' : game;
  const { opts } = cfg;
  const pinBy = game === 'pin' && deck.scope === 'countries' ? opts.pinBy : 'name';
  const seed = useMemo(() => seedOf(cfg), [cfg]);
  // Reviews, challenges and the repeat of what was missed are always a plain set of questions.
  const format: Format = formatOfGame(cfg);
  /**
   * Two players who share the device (lib/duo.ts): a question each, by turns. Nothing of such a game is
   * written down: neither the answers, which are not one person's, nor the game among those played.
   */
  const duo = format === 'duo';
  /** Which of the two opens this game. */
  const first: Who = duo && cfg.duo?.first === 1 ? 1 : 0;
  /** Against the clock or with lives: the game lasts what the clock or the lives say. */
  const paced = format === 'timed' || format === 'lives';
  /** An exam: nothing is said about an answer until it is handed in. */
  const exam = format === 'exam';
  /** One go at each question, and no hints. */
  const strict = paced || exam;
  /**
   * The rules the game is played by (lib/ruleset.ts): the tries of a question, whether hints can be asked
   * for, how long the clock runs and how many lives there are.
   */
  const rules = useMemo(() => rulesOfGame(cfg), [cfg]);
  /** Against the clock: how long the game lasts. */
  const limit = rules.clock * 1000;
  /** No hint can be asked for: the format gives none, or the player has done without them. */
  const unaided = strict || !rules.hints;

  /** Items that can be offered as wrong options when asking in a given way. */
  const usableFor = useMemo(() => {
    const cache = new Map<QuizMode, Item[]>();
    return (m: QuizMode): Item[] => {
      let list = cache.get(m);
      if (!list) {
        const needsCapital = m === 'capital' || (m === 'pin' && pinBy === 'capital');
        const needsFlag = m === 'flag' || (m === 'pin' && pinBy === 'flag');
        list = deck.items.filter((it) => (!needsCapital || it.capital?.length) && (!needsFlag || it.country.fl) && (m !== 'puzzle' || it.shape === 'area') && (m !== 'parent' || it.belongs));
        cache.set(m, list);
      }
      return list;
    };
  }, [deck, pinBy]);
  /** How a question asked in a given way is answered, and among what. */
  const waysOf = (m: QuizMode) => {
    /** Answered by clicking on the map. */
    const clicky = m === 'pin' || m === 'puzzle';
    const usable = usableFor(m);
    /**
     * Four options are no good where the wrong ones would be capitals named after their own region: there
     * the answer is typed, whatever the settings say.
     */
    const mustType = m === 'capital' && opts.answer !== 'type' && !cfg.challenge?.legacy && capitalsNeedTyping(usable);
    return { clicky, usable, mustType, typed: !clicky && (opts.answer === 'type' || mustType) };
  };

  /**
   * The way a medley asks about each of its pieces, by the lot of a seed. The misses of a medley are played
   * again with the lot of the game they come from: each is asked the way it was missed.
   */
  const lotOf = (k: number) => {
    // Where the map has too few capitals for four options to be fair, the medley leaves them out.
    const rules = { capitals: opts.answer === 'type' || !capitalsNeedTyping(deck.items), loose: opts.answer !== 'type' };
    return new Map(deck.items.map((it) => [it.id, askOf(cfg.lot ?? k, it.id, asksFor(it, deck.scope, rules))] as const));
  };
  /** The way each piece of a medley is asked about. */
  const asks = useMemo(
    () => (medley ? lotOf(seed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [medley, deck, seed, cfg.lot, opts.answer],
  );

  /** Items that can be asked: a place named after its capital would answer itself. */
  const askable = useMemo(() => {
    // In a medley every piece is asked in a way that suits it.
    if (!fixed) return deck.items;
    const { usable, typed } = waysOf(fixed);
    const needsCapital = fixed === 'capital' || pinBy === 'capital';
    // A piece named after what it belongs to would answer itself as well.
    if (fixed === 'parent') return usable.filter((it) => !belongsItself(it, !typed));
    // A link from before this rule is played with the questions its sender had.
    if (!needsCapital || cfg.challenge?.legacy) return usable;
    // A review brings back what is due, and nothing may be left waiting for ever: the likeness that would
    // give an answer away among four options is let through, and only what answers itself is dropped.
    if (cfg.review) return fixed === 'capital' ? usable.filter((it) => !answersItself(it, false)) : usable;
    return usable.filter((it) => !answersItself(it, !typed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usableFor, fixed, pinBy, deck, opts.answer, cfg.review, cfg.challenge]);
  /** Capitals that were due for review and are no longer asked: taken off the tallies, or they would be due for ever. */
  const retired = useMemo(
    () => (fixed === 'capital' && cfg.review && cfg.only ? usableFor('capital').filter((it) => cfg.only!.includes(it.id) && answersItself(it, false)).map((it) => it.id) : []),
    [usableFor, fixed, cfg.review, cfg.only],
  );
  const pool = useMemo(() => (cfg.only ? askable.filter((it) => cfg.only!.includes(it.id)) : askable), [askable, cfg.only]);

  /** The game a seed deals on this map: its own, and the one any other seed would have dealt. */
  const deal = (k: number) =>
    initQuiz(
      // Sorted first: the same seed must give the same questions whatever order the map was built in.
      pool.map((it) => it.id).sort(),
      // A game of two is dealt in pairs of questions, so that both have as many turns.
      duo ? evenOf(cfg.only || typeof opts.length !== 'number' ? pool.length : Math.min(opts.length, pool.length)) : paced ? 'endless' : cfg.only ? 'all' : opts.length,
      // Against the clock there is no time to be shown where each miss was. In a medley, each miss says
      // whether it has a place on the map to show.
      (medley || waysOf(fixed!).clicky) && format !== 'timed',
      mulberry32(k),
      exam,
      // Nor is a miss asked again: a question is one turn.
      duo,
    );
  const [s, dispatch] = useReducer(quizReducer, null, () => deal(seed));
  const item = s.cur ? (deck.byId.get(s.cur) ?? null) : null;
  /** The way the question in hand is asked. */
  const modeOf = (it: Item | null): QuizMode => fixed ?? (it && asks?.get(it.id)) ?? 'pin';
  const mode = modeOf(item);
  const { clicky, usable, mustType, typed } = waysOf(mode);
  /** What was answered to each question of an exam that went wrong, to be read in the marking. */
  const given = useRef<Record<string, string>>({});
  const ended = s.phase === 'end';
  const clock = useClock(!ended);
  const { ms } = clock;
  const map = useRef<MapHandle>(null);
  const record = useStore((st) => st.record);
  const mixUp = useStore((st) => st.mixUp);
  const forget = useStore((st) => st.forget);
  const addSession = useStore((st) => st.addSession);
  const setBest = useStore((st) => st.setBest);
  const timeLeft = Math.max(0, limit - ms);
  const lives = Math.max(0, rules.lives - s.bad);
  /** Out of lives: the answer in hand is the last one. */
  const spent = format === 'lives' && lives === 0;
  /** Best mark of this map in the paced formats: 'new' when just beaten, the old one otherwise. */
  const [mark, setMark] = useState<'new' | number | null>(null);
  /** A challenge with a date (lib/dated.ts): how its result has gone on record, once the game is over. */
  const [kept, setKept] = useState<Kept | null>(null);

  /** Shown in a box of another page (screens/Embed.tsx), where a game is one go and nothing is set beside it. */
  const boxed = useStore((st) => st.hosted != null);
  /** A game that leaves a ghost when it is the best of its map, and can be played against the one there is (lib/ghost.ts). */
  const haunted = useMemo(() => ghostable(cfg), [cfg]) && s.total > 0 && !boxed;
  /** Played against its ghost: its same questions, with that game moving alongside. */
  const racing = haunted && !!cfg.ghost;
  /** When each question was settled, by the clock of the game, and how: what a ghost is made of. */
  const [trace, setTrace] = useState<[number, Res][]>([]);
  const [someGhost] = useState(anyGhost);
  /**
   * What knows about ghosts, fetched when there is one to show or to keep: from the start in a game against
   * one; otherwise once half the questions are answered, so that it is here when the game ends, or at the
   * end of a game left before that if there may be a ghost to offer.
   */
  const ghosts = useGhostCode(haunted && (racing || s.asked * 2 >= s.total || (ended && s.asked > 0 && someGhost)));
  /** The ghost the game is played against: unknown until that code is here, and null if there is none after all. */
  const [rival, setRival] = useState<Ghost | null | undefined>(undefined);
  /** What there is to say about the ghost once the game is over. */
  const [ghostEnd, setGhostEnd] = useState<GhostEnd | null>(null);
  const ghostSettled = useRef(false);
  /**
   * The questions a seed deals here, each as a word and in order: what tells whether a game kept from before
   * answered these same ones. In a medley the way a piece is asked is part of the question.
   */
  const dealt = (k: number): string[] => {
    const first = deal(k);
    const ids = first.cur ? [first.cur, ...first.queue] : [];
    const lot = medley ? lotOf(k) : null;
    return lot ? ids.map((id) => `${id}:${lot.get(id)}`) : ids;
  };
  const race = () => {
    const countries = new Map(deck.countries.map((c) => [c.id, c] as const));
    return { cfg, country: (id: string) => countries.get(id), seed, dealt };
  };

  /** A game of two: how each answer went, in the order they were asked. Whose each one was follows from that. */
  const [plays, setPlays] = useState<[string, Res][]>([]);
  /** What the two are called: read once, since names are given where the game is set up. */
  const [players] = useState(() => namesShown(namesKept()));
  /** What draws a game of two (games/Duo.tsx), fetched as it starts. */
  const duoUi = useDuoCode(duo);
  /** That code is taking long, or is not coming: the game says the same in plain words meanwhile. */
  const [duoLate, setDuoLate] = useState(false);
  useEffect(() => {
    if (!duo || duoUi) return undefined;
    const t = setTimeout(() => setDuoLate(true), 1500);
    return () => clearTimeout(t);
  }, [duo, duoUi]);
  const tallied = useMemo(() => tally(plays.map((p) => p[1]), first), [plays, first]);
  /** What a game set as homework ends with (games/TaskReceipt.tsx), fetched as it starts: each start of it is counted. */
  const homework = useTaskCode(!!cfg.task);
  useEffect(() => {
    if (cfg.task) homework?.begin(cfg.task, cfg.nonce);
  }, [homework, cfg]);
  /** Whose each piece is: the map of a game of two is painted by who got it, once what colours it is here. */
  const owners = useMemo(() => (duo && duoUi ? new Map(plays.map(([id], i) => [id, whoOf(i, first)] as const)) : null), [duo, duoUi, plays, first]);

  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [showMap, setShowMap] = useState(false);
  /** Pin hint: the only items still in play; the rest are dimmed. */
  const [narrow, setNarrow] = useState<Set<string> | null>(null);
  /**
   * The help given with the question in hand. `main` counts the hints of the kind its game always had (a
   * letter, the search narrowed, the map, the name); `said` are the others, each a fact about the piece
   * (lib/hints.ts), `used` their kinds, and `cut` the options that one of them took away.
   */
  const [help, setHelp] = useState<{ main: number; used: HintKind[]; said: Hint[]; cut: string[]; open: boolean }>(NO_HELP);
  /** The panel of the question: where the menu of hints, what they say and the way of answering are looked for. */
  const box = useRef<HTMLDivElement>(null);

  const names = useMemo(() => new Matcher(deck.items), [deck]);
  // Capitals are listed under the id of their place, whose code is not theirs.
  const capitals = useMemo(
    () =>
      new Matcher(
        usableFor('capital')
          .map((it) => capitalAnswers(it))
          .filter((a): a is Answerable => !!a),
        { codes: false },
      ),
    [usableFor],
  );
  /** What the pieces belong to, once each: the answers of "¿A qué pertenece?". */
  const groups = useMemo(() => {
    const all = new Map<string, Belongs>();
    if (mode === 'parent') for (const it of usable) if (it.belongs && !all.has(it.belongs.id)) all.set(it.belongs.id, it.belongs);
    return all;
  }, [usable, mode]);
  const parents = useMemo(() => new Matcher([...groups.values()]), [groups]);
  const matcher = mode === 'capital' ? capitals : mode === 'parent' ? parents : names;
  /** How many letters of the answer the hints have put in sight (the first hint of an outline is the map). */
  const lettersShown = !typed ? 0 : mode === 'outline' ? Math.max(0, help.main - 1) : help.main;
  const answerOf = (it: Item, m: QuizMode = mode) => (m === 'capital' ? it.capital![0] : m === 'parent' ? it.belongs!.name : it.name);
  // A paced game moves fast, and an exam is an exam: one go at each question.
  const maxTries = strict ? 1 : clicky || typed ? rules.tries : 1;
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const one = deck.noun.one;
  /** "la provincia" · "the province" */
  const theOne = L(`${fem ? 'la' : 'el'} ${one}`, `the ${one}`);
  const left = (n: number) => L(`${n === 1 ? 'Te queda' : 'Te quedan'} ${n} ${n === 1 ? 'intento' : 'intentos'}.`, `${n} ${n === 1 ? 'try' : 'tries'} left.`);

  // Four options: the right one and three of its nearest neighbours.
  const choices = useMemo(() => {
    if (!item || typed || clicky) return [];
    const label = answerOf(item);
    let cands = usable.filter((o) => o.id !== item.id && answerOf(o) !== label);
    // A capital named after its own place ("Madrid") is ruled out at a glance, and three of those leave the
    // answer standing alone: the wrong options are capitals that have to be known.
    if (mode === 'capital') {
      const hard = cands.filter((o) => !answersItself(o, true));
      if (hard.length >= 3) cands = hard;
    }
    // On a physical map a sea is told apart from a river at a glance: the wrong options are of the same kind.
    if (item.cat) {
      const same = cands.filter((o) => o.cat === item.cat);
      if (same.length >= 3) cands = same;
    }
    if (mode === 'parent') {
      // The options are groups, not pieces: one piece stands for each of the other groups, the nearest first.
      const seen = new Set([label]);
      cands = nearest(item, cands, cands.length).filter((o) => !seen.has(answerOf(o)) && !!seen.add(answerOf(o)));
    } else {
      // What is already solved is labelled on the map and could be ruled out without knowing anything.
      // An exam labels nothing: every piece stays an option to the end.
      const open = exam ? cands : cands.filter((o) => !s.marks[o.id]);
      if (open.length >= 3) cands = open;
    }
    const rng = mulberry32(seed + s.n * 7919);
    return shuffle([item, ...sample(nearest(item, cands, 9), 3, rng)], rng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  /** The kinds of hint the question in hand admits besides the one of its game: a fact about the piece each. */
  const kinds = useMemo((): HintKind[] => {
    if (!item || unaided) return [];
    const ask: HintAsk = {
      wants: clicky ? 'place' : mode === 'capital' ? 'capital' : mode === 'parent' ? 'parent' : 'name',
      by: clicky ? 'click' : typed ? 'type' : 'pick',
      shows: {
        // By ear the name is not written, but writing it is the hint that game always had.
        name: mode === 'pin' && pinBy === 'name',
        place: mode === 'identify' || mode === 'capital' || (mode === 'parent' && item.kind !== 'city') || (mode === 'outline' && showMap),
        capital: mode === 'pin' && pinBy === 'capital',
        flag: mode === 'flag' || (mode === 'pin' && pinBy === 'flag'),
      },
    };
    return hintKinds(item, deck, ask, places);
  }, [item, unaided, clicky, typed, mode, pinBy, showMap, deck, places]);

  // New question: clean the per-question state and, when a region lights up, bring it into view.
  useEffect(() => {
    setNote(null);
    setPicked(null);
    setShowMap(false);
    setClear((n) => n + 1);
    setNarrow(null);
    setHelp(NO_HELP);
    // Naming what the map shows needs a close look; for a capital, knowing where the country is will do.
    if (s.cur && mode === 'identify') map.current?.focus([s.cur]);
    // In a medley the last question may have left the map anywhere: each one starts from the whole of it.
    else if (medley) map.current?.reset();
    // Where the map went to show the last answer, it comes back: the next one may be at the other end.
    else if (clicky) map.current?.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  // By ear: the name is said when the question comes up, and again whenever the loudspeaker is pressed.
  // Not over the rules of the game while they are read: it is said when they are put away.
  const waiting = usePaused();
  useEffect(() => {
    if (!voiced || !item || s.phase !== 'ask') return;
    if (clockPaused()) hush();
    else speak(item.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n, waiting]);
  useEffect(() => (voiced ? hush : undefined), [voiced]);

  // A first-time right answer moves on by itself; against the clock, so does a miss, after a look at the answer.
  useEffect(() => {
    if (s.phase !== 'done' || spent) return;
    if (s.last !== 'ok' && format !== 'timed') return;
    const t = setTimeout(() => dispatch({ type: 'next' }), s.last !== 'ok' ? 1400 : format === 'timed' ? 420 : mode === 'pin' ? 650 : 1100);
    return () => clearTimeout(t);
  }, [s.phase, s.last, s.n, mode, format, spent]);

  // An exam says nothing about an answer but that it has been taken: the question changes at once, and
  // without a word it could pass unnoticed.
  useEffect(() => {
    if (!exam || s.n === 0 || ended) return;
    setNote(L('Respuesta anotada.', 'Answer noted.'));
    const t = setTimeout(() => setNote(null), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  useEffect(() => {
    if (retired.length) forget('cap', retired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time is up.
  useEffect(() => {
    if (format === 'timed' && !ended && ms >= limit) dispatch({ type: 'finish' });
  }, [format, ended, ms, limit]);

  useEffect(() => {
    // A game of two is not one of the games of whoever keeps their progress here.
    if (!ended || !s.asked || duo) return;
    const what = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: what,
      total: s.asked,
      ok: s.ok,
      warn: s.warn,
      bad: s.bad,
      ms,
      ...(format !== 'normal' ? { note: format } : {}),
    });
    if (paced && !cfg.list) {
      // Each length of the clock and each number of lives has a record of its own.
      const key = `${recordName(format as 'timed' | 'lives', rules)}:${game}:${deck.key}`;
      const prev = useStore.getState().best[key];
      const hits = s.ok + s.warn;
      // A game without a single right answer sets no record.
      setMark(hits > 0 && setBest(key, hits) ? 'new' : (prev ?? null));
    }
    // A challenge with a date counts the first time it is answered to the end.
    if (isDated(cfg)) setKept(keepDated(cfg, s.asked >= s.total, { s: scoreOf(s.ok, s.warn, s.asked), ok: s.ok, n: s.asked, ms }));
    // The best mark of a map is that of an exam on all of it, answered to the end.
    if (exam && !cfg.list && s.total === pool.length && s.asked === s.total) {
      const key = `exam:${game}:${deck.key}`;
      const prev = useStore.getState().best[key];
      const tenths = Math.round(gradeOf(s.ok, s.total) * 10);
      setMark(tenths > 0 && setBest(key, tenths) ? 'new' : (prev ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  // The ghost to play against is looked for once, as soon as the code that knows about ghosts is here: the
  // game may well take its place in the end, and it is still the one it was played against. Before the game
  // is painted: when that code is here from the start, so are the two lanes.
  useLayoutEffect(() => {
    if (racing && ghosts && rival === undefined) setRival(ghosts.rivalOf(race()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghosts]);

  // The game is over: it is kept as the ghost of its map if it is the best one so far, and the results tell of
  // it. Before they are painted, so that they come with it and not a moment later.
  useLayoutEffect(() => {
    if (!ended || !ghosts || ghostSettled.current || (racing && rival === undefined)) return;
    ghostSettled.current = true;
    // The clock is read and not taken as it is shown: it has stopped by now, and what is shown runs half a second late.
    setGhostEnd(ghosts.settle(race(), trace, clock.read(), rival ?? null, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, ghosts, rival]);

  const settled = (res: Res, it: Item) => {
    const skill = SKILL[mode];
    // Once each: a piece is asked one time in such a game.
    if (duo) setPlays((p) => (p.some(([id]) => id === it.id) ? p : [...p, [it.id, res]]));
    else if (s.round === 1 && skill) record(skill, it.id, res, originOf(it, cfg));
    if (s.round === 1 && haunted) {
      // Read now, and not when the list is put together.
      const at = clock.read();
      setTrace((t) => [...t, [at, res]]);
    }
    // An exam keeps what it knows to itself until it is handed in.
    if (exam) return;
    setFlash({ id: it.id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    if (!clicky || res === 'bad') map.current?.focus([it.id], { passing: clicky });
  };

  const right = () => {
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'right' });
    setNote(null);
    settled(s.tries === 0 && s.hints === 0 ? 'ok' : 'warn', item);
  };

  const wrong = (message: string | null, blink?: string) => {
    if (!item || s.phase !== 'ask') return;
    const failed = s.tries + 1 >= maxTries;
    dispatch({ type: 'wrong', max: maxTries, reveal: clicky });
    setNote(failed ? null : message);
    // A field that shakes says "wrong": not in an exam.
    if (!exam) setShake((n) => n + 1);
    if (failed) settled('bad', item);
    else {
      // Wrong with tries left: its own short sound, apart from the one that settles the question.
      answered('try');
      if (blink) setFlash({ id: blink, kind: 'bad', n: Date.now() });
    }
  };

  /**
   * Another piece of the map was the answer: written down as a mix-up of the two, which the progress
   * shows and offers to practise. Returns what there is to say when it is not the first time.
   */
  const mixed = (given: string): string => {
    const skill = SKILL[mode];
    // Nor are the mix-ups of two players anybody's.
    if (duo || !item || !skill || given === item.id || !deck.byId.has(given)) return '';
    const before = timesMixed(useStore.getState().mix, skill, item.id, given);
    mixUp(skill, item.id, given);
    // Nothing is said in an exam, and the first time is just a miss.
    return exam || before < 1 ? '' : ` ${L(`Ya van ${before + 1} veces que confundes ${fem ? 'las' : 'los'} dos.`, `That makes ${before + 1} times you have mixed the two up.`)}`;
  };

  const giveUp = () => {
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'giveup', reveal: clicky });
    setNote(null);
    settled('bad', item);
  };

  const next = () => dispatch(spent ? { type: 'finish' } : { type: 'next' });

  const onPick = (id: string) => {
    if (!item || !clicky) return;
    if (s.phase === 'reveal') {
      if (id === item.id) next();
      return;
    }
    if (s.phase !== 'ask') return;
    if (id === item.id) return right();
    const other = deck.byId.get(id);
    if (!other) return;
    if (exam) {
      mixed(id);
      // Any piece can be the answer, also one already given to another question: nothing says how that went.
      given.current[item.id] = other.name;
      return wrong(null);
    }
    if (s.marks[id] && !hidden.has(id)) {
      setNote(L(`${other.name} ya está ${fem ? 'resuelta' : 'resuelto'}.`, `${other.name} is already solved.`));
      return;
    }
    if (narrow && !narrow.has(id)) {
      setNote(L(`${other.name} está ${fem ? 'descartada' : 'descartado'}: busca entre ${fem ? 'las iluminadas' : 'los iluminados'}.`, `${other.name} is ruled out: look among the lit ones.`));
      return;
    }
    wrong(`${L(`Eso es ${other.name}.`, `That is ${other.name}.`)}${mixed(id)}`, id);
  };

  const onSubmit = (text: string) => {
    if (!item || s.phase !== 'ask') return;
    // Letters of the answer in sight would spell its abbreviation out: the name has to be written.
    const v = matcher.check(text, mode === 'parent' ? item.belongs!.id : item.id, { whole: lettersShown > 0 });
    if (v.res === 'yes') return right();
    if (v.res === 'short' || v.res === 'vague') {
      // Not a wrong answer: an abbreviation that does not count here, and why.
      setShake((n) => n + 1);
      setNote(shortNote(v.res, text));
      return;
    }
    if (exam) {
      // What was written, by its proper name where it is the name of something else here.
      const meant = v.res !== 'other' ? undefined : mode === 'parent' ? groups.get(v.id)?.name : deck.byId.get(v.id) && answerOf(deck.byId.get(v.id)!);
      given.current[item.id] = meant || text.trim();
      if (v.res === 'other' && mode !== 'parent') mixed(v.id);
      return wrong(null);
    }
    if (v.res === 'other') {
      if (mode === 'parent') {
        const group = groups.get(v.id)?.name ?? text.trim();
        return wrong(L(`No es ${group}.`, `It is not ${group}.`));
      }
      const other = deck.byId.get(v.id)!;
      const again = mixed(v.id);
      if (mode === 'capital') wrong(`${L(`${other.capital![0]} es la capital de ${other.name}.`, `${other.capital![0]} is the capital of ${other.name}.`)}${again}`);
      else wrong(`${L(`No es ${other.name}.`, `It is not ${other.name}.`)}${again}`, mode === 'identify' ? v.id : undefined);
    } else wrong(L('No es correcto.', 'That is not right.'));
  };

  const onChoice = (id: string) => {
    if (!item || s.phase !== 'ask' || help.cut.includes(id)) return;
    if (id === item.id) right();
    else {
      const other = deck.byId.get(id);
      if (exam && other) given.current[item.id] = answerOf(other);
      if (other) mixed(id);
      setPicked(id);
      wrong(null);
    }
  };

  const hint = () => {
    if (!item || s.phase !== 'ask' || unaided) return;
    dispatch({ type: 'hint' });
    setHelp((h) => ({ ...h, main: h.main + 1 }));
    // By ear, the help is to read the name: the hint writes it.
    if (voiced) return;
    if (clicky) {
      // Narrow the search: the answer and a few of its nearest neighbours stay lit.
      const open = usable.filter((it) => !s.marks[it.id] || hidden.has(it.id));
      const keep = [item, ...nearest(item, open, Math.min(4, Math.max(1, Math.floor(open.length / 3))))].map((it) => it.id);
      setNarrow(new Set(keep));
      map.current?.focus(keep, { fill: 0.6, passing: true });
    } else if (mode === 'outline') setShowMap(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea, summary')) return;
      if ((e.key === 'Enter' || e.key === ' ') && (s.phase === 'done' || s.phase === 'reveal')) {
        e.preventDefault();
        next();
      } else if (!typed && s.phase === 'ask' && /^[1-4]$/.test(e.key)) {
        const c = choices[Number(e.key) - 1];
        if (c && !help.cut.includes(c.id)) onChoice(c.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The menu opens under the buttons, where a short panel (a phone) may not reach: it is brought into view, and
  // whoever opened it with the keyboard is taken to its first hint instead of past two more buttons.
  useEffect(() => {
    if (!help.open) return;
    const menu = box.current?.querySelector<HTMLElement>('.q-more');
    menu?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    menu?.scrollIntoView({ block: 'nearest' });
  }, [help.open]);
  // Once a hint is given its button is gone, and what had the keyboard with it. It goes back to where the
  // answer is given: the field, the options (their number keys do not work from a button), or the menu of hints.
  useEffect(() => {
    const root = box.current;
    if (!help.used.length || !root) return;
    const to = typed ? root.querySelector<HTMLElement>('.answer-input') : clicky ? (root.querySelector<HTMLElement>('.q-more-btn') ?? root.querySelector<HTMLElement>('.q-said')) : root.querySelector<HTMLElement>('.choices');
    to?.focus({ preventScroll: true });
    root.querySelector('.q-said')?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [help.used.length]);

  /** Items still to be asked must not give themselves away with a colour, a label or a tooltip. */
  const hidden = useMemo(() => {
    // Once the game is over nothing is left to ask: the map shows how every piece went.
    if (ended) return new Set<string>();
    const set = new Set<string>(s.round === 2 || s.endless ? s.queue : []);
    if (s.cur && s.phase === 'ask') set.add(s.cur);
    return set;
  }, [s.queue, s.cur, s.phase, s.round, s.endless, ended]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    // The map of an exam stays as blank as the sheet it is: how each answer went is seen at the end.
    if (!exam || ended) for (const [id, res] of Object.entries(s.marks)) if (!hidden.has(id)) p[id] = !owners ? res : res === 'bad' ? 'px' : owners.get(id) === 1 ? 'pb' : 'pa';
    if (item && !ended) {
      // A city lit up on a map of several countries would show which one it is in, and that is the question.
      const shown = mode === 'identify' || mode === 'capital' || (mode === 'parent' && item.kind !== 'city') || (mode === 'outline' && showMap);
      if (s.phase === 'reveal' || (s.phase === 'ask' && shown)) p[item.id] = 'target';
      if (narrow && s.phase === 'ask') for (const it of deck.items) if (!narrow.has(it.id) && !p[it.id]) p[it.id] = 'dim';
    }
    return p;
  }, [s.marks, s.phase, hidden, item, ended, mode, showMap, narrow, deck, exam, owners]);

  const labels = useMemo(() => {
    if (ended) return 'all' as const;
    if (!opts.labels || exam) return undefined;
    return new Set(Object.keys(s.marks).filter((id) => !hidden.has(id)));
  }, [ended, opts.labels, s.marks, hidden, exam]);

  const pinned = useMemo(() => (item && !ended && s.phase !== 'ask' ? new Set([item.id]) : undefined), [item, ended, s.phase]);

  /** Turned outlines: how far this one is, the same every time it is asked in this game. */
  const turned = opts.turned && mode === 'outline' && item ? turnOf(seed, item.id) : 0;
  const outlinePath = useMemo(() => (mode === 'outline' && item ? silhouette(item.geo, 400, 0.08, turned) : ''), [mode, item, turned]);
  /** The jigsaw piece, drawn smaller the smaller it is next to the biggest one: size is a clue too. */
  const piece = useMemo(() => {
    if (mode !== 'puzzle' || !item) return null;
    const biggest = usable.reduce((m, it) => Math.max(m, it.area), 0) || 1;
    // The scale is compressed, or the small pieces of a map with one giant would be specks.
    return { d: silhouette(item.geo, 240, 0.04), k: Math.max(0.45, Math.min(1, (item.area / biggest) ** 0.3 * 1.1)) };
  }, [mode, item, usable]);

  const suggest = useMemo(() => {
    if (!typed || !opts.suggest) return undefined;
    if (mode === 'parent') {
      return (text: string): Suggestion[] =>
        matcher
          .suggest(text, 6)
          .map((id) => groups.get(id))
          .filter((g): g is Belongs => !!g)
          .map((g) => ({ id: g.id, label: g.name }));
    }
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 6)
        .map((id) => deck.byId.get(id))
        .filter((it): it is Item => !!it)
        .map((it) => ({ id: it.id, label: answerOf(it), sub: mode === 'capital' ? undefined : several ? nm(it.country.n) : undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, opts.suggest, matcher, deck, mode, several, groups]);

  // ------------------------------------------------------------------ render

  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = ended ? undefined : item?.id;

  const title = MODE_NAME[game];
  /** Under the name of the game, its map; or the challenge with a date that it is. */
  const subtitle = datedName(cfg, deck, places) ?? deck.title;
  const stage = (
    <>
      <MapView
        ref={map}
        deck={deck}
        paint={paint}
        // Only while a question is open: after it, Enter on the map is "next", not an answer.
        pickable={clicky && s.phase === 'ask'}
        // After a miss the answer blinks and a click on it goes on: it has to look like it can be clicked.
        pressable={clicky && s.phase === 'reveal'}
        onPick={onPick}
        labels={labels}
        pinned={pinned}
        flash={flash}
        blind={mode === 'puzzle' && !ended}
        tip={(id) => (ended || (!exam && s.marks[id] && !hidden.has(id)) ? deck.byId.get(id)?.name : null)}
      />
      {mode === 'outline' && item && !ended && s.phase === 'ask' && !showMap && (
        <div className="outline-stage">
          <svg viewBox="0 0 400 400" role="img" aria-label={L('Silueta que hay que reconocer', 'Outline to recognise')}>
            <path d={outlinePath} />
          </svg>
        </div>
      )}
    </>
  );

  if (ended) {
    /** The marking of an exam: the answer where the name of the piece is not it, and what was answered where it was wrong. */
    const marking = (it: Item, res: Res): string | undefined => {
      const m = modeOf(it);
      const said = given.current[it.id];
      const parts = [
        // A medley says how each piece was asked about.
        medley ? MODE_NAME[m] : '',
        (exam || medley) && (m === 'capital' || m === 'parent') ? answerOf(it, m) : '',
        !exam || res !== 'bad' ? '' : !said ? L('en blanco', 'left blank') : waysOf(m).clicky ? L(`señalaste ${said}`, `you picked ${said}`) : L(`respondiste «${said}»`, `you answered “${said}”`),
      ];
      return parts.filter(Boolean).join(' · ') || undefined;
    };
    // In a game of two the order matters: it says whose each answer was.
    const rows: ResultRow[] = (duo ? plays : Object.entries(s.results)).map(([id, res]) => ({ item: deck.byId.get(id)!, res, note: marking(deck.byId.get(id)!, res) }));
    const score = scoreOf(s.ok, s.warn, s.asked);
    const hits = s.ok + s.warn;
    const grade = gradeOf(s.ok, s.total);
    const blank = Number.isFinite(s.total) ? s.total - s.asked : 0;
    /** The paced format as its record is told of: with its rule when it is not the usual one ("contrarreloj de 2 minutos"). */
    const paceName = `${formatName(format).toLowerCase()}${customRules(rules) ? L(` de ${rulesText(rules)}`, ` of ${rulesText(rules)}`) : ''}`;
    /** Played against the ghost to the end: who won is what the results open with, and the ghost's figures come under it. */
    const duel = rows.length && ghostEnd?.other && (ghostEnd.how === 'won' || ghostEnd.how === 'lost' || ghostEnd.how === 'tie') ? { how: ghostEnd.how, ghost: ghostEnd.other } : null;
    /** A game of two answered to its end; one ended before that is settled by its whole rounds, and nobody wins it. */
    const duoDone = s.asked >= s.total;
    /** Another game of two: the one who went second opens it. */
    const duoAgain = () => onAgain({ only: cfg.only, list: cfg.list, duo: { first: otherOf(first) } });
    /** What the result of a game of two says first, for when what draws it has not come. */
    const duoSaid = duo && rows.length ? verdictOf(players, tally(plays.map((p) => p[1]), first, true), duoDone) : null;
    if (duo && duoUi && rows.length)
      return (
        <GameShell
          title={title}
          subtitle={subtitle}
          onExit={onExit}
          hud={<Hud ms={ms} />}
          stage={stage}
          panel={<duoUi.DuoResults names={players} rows={rows} first={first} done={duoDone} several={several} onAgain={duoAgain} onExit={onExit} />}
        />
      );
    return (
      <GameShell
        title={title}
        subtitle={subtitle}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={
              !rows.length
                ? L('Sin preguntas', 'No questions')
                : duoSaid
                  ? duoSaid.title
                : duel
                  ? duel.how === 'won'
                    ? L('¡Has ganado a tu fantasma!', 'You beat your ghost!')
                    : duel.how === 'lost'
                      ? L('Gana tu fantasma', 'Your ghost wins')
                      : L('Empate con tu fantasma', 'A tie with your ghost')
                : exam
                  ? L(`Nota: ${nf(grade, 1)}`, `Mark: ${nf(grade, 1)} out of 10`)
                  : paced
                  ? L(`${hits} ${hits === 1 ? 'acierto' : 'aciertos'}${format === 'timed' ? ` en ${clockText(rules.clock)}` : ''}`, `${hits} right${format === 'timed' ? ` in ${clockText(rules.clock)}` : ''}`)
                  : s.bad === 0 && s.warn === 0
                    ? L('¡Pleno!', 'Full marks!')
                    : s.bad === 0
                      ? L('¡Muy bien!', 'Well done!')
                      : L('Partida terminada', 'Game over')
            }
            note={
              kept != null && rows.length
                ? datedNote(subtitle, cfg, kept, score)
                : duoSaid
                ? duoSaid.note
                : duel
                ? L(`Tu fantasma: ${duel.ghost.score}\u00a0% en ${fmtTime(duel.ghost.ms)}.`, `Your ghost: ${duel.ghost.score}% in ${fmtTime(duel.ghost.ms)}.`)
                : !rows.length && retired.length
                ? L(
                    `Lo que tocaba repasar eran capitales que se llaman como su ${one}: ya no se preguntan, así que salen del repaso.`,
                    `What was due were capitals named after their ${one}: they are no longer asked, so they leave the review.`,
                  )
                : exam && rows.length
                  ? [
                      blank > 0
                        ? L(
                            `Entregaste con ${nf(blank)} ${blank === 1 ? 'pregunta' : 'preguntas'} sin responder, que ${blank === 1 ? 'cuenta' : 'cuentan'} como en blanco.`,
                            `You handed it in with ${nf(blank)} ${blank === 1 ? 'question' : 'questions'} unanswered, which ${blank === 1 ? 'counts' : 'count'} as left blank.`,
                          )
                        : L(`${nf(s.ok)} de ${nf(s.total)} bien.`, `${nf(s.ok)} of ${nf(s.total)} right.`),
                      mark === 'new'
                        ? L('Es tu mejor nota en este mapa.', 'It is your best mark on this map.')
                        : typeof mark === 'number'
                          ? L(`Tu mejor nota en este mapa: ${nf(mark / 10, 1)}.`, `Your best mark on this map: ${nf(mark / 10, 1)}.`)
                          : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                : !paced || !rows.length
                ? undefined
                : mark === 'new'
                  ? L(`Nuevo récord de ${paceName} en este mapa.`, `New ${paceName} record on this map.`)
                  : typeof mark === 'number'
                    ? L(`Tu récord de ${paceName} en este mapa: ${mark}.`, `Your ${paceName} record on this map: ${mark}.`)
                    : undefined
            }
            deck={deck}
            rows={rows}
            // An exam is marked over all its questions: the ones not reached count with the misses.
            counts={exam && rows.length ? { ok: s.ok, warn: 0, bad: s.total - s.ok } : undefined}
            ms={ms}
            stats={[{ label: L('Mejor racha', 'Best streak'), value: s.bestStreak }]}
            again={rows.length > 0 || !retired.length}
            // A challenge with a date that was left before its end is still to be played: again is the same one.
            // Once it is on record, again is a game like any other: new questions, and nothing written down.
            // Again after a game against the ghost is against the ghost: the one the map has now, which may be this game.
            onAgain={duo ? duoAgain : () => onAgain(isDated(cfg) && (kept == null || kept === 'short') ? {} : { only: cfg.only, list: cfg.list, ...UNDATED, ghost: racing && ghostEnd?.seed != null ? { seed: ghostEnd.seed } : undefined })}
            // The misses of a game of two are of both: there is no round of them for one.
            // The round of what was missed is not the assignment: it leaves no receipt.
            onReview={duo ? undefined : (ids) => onAgain({ only: ids, list: undefined, ...UNDATED, ...NO_GHOST, task: undefined, lot: medley ? (cfg.lot ?? seed) : undefined })}
            onExit={onExit}
            // Homework ends on its receipt: Enter must not start it again, which would be one more attempt.
            focus={!cfg.task}
          >
            {cfg.task &&
              rows.length > 0 &&
              (homework ? (
                <homework.TaskReceipt task={cfg.task} nonce={cfg.nonce} tally={{ ok: s.ok, warn: s.warn, bad: s.bad, total: !paced && Number.isFinite(s.total) ? s.total : 0, ms: format === 'timed' ? Math.min(ms, limit) : ms }} format={format} />
              ) : (
                <p role="status">{L('Preparando el justificante…', 'Getting the receipt ready…')}</p>
              ))}
            {rows.length > 0 && ghosts && ghostEnd && (
              <ghosts.GhostBox
                end={ghostEnd}
                racing={racing && !!rival}
                onRace={(k) => onAgain({ only: cfg.only, list: cfg.list, ghost: { seed: k } })}
                onPlain={() => onAgain({ only: cfg.only, list: cfg.list, ...NO_GHOST })}
              />
            )}
            {rows.length > 0 && format === 'normal' && s.asked >= s.total && <ChallengeBox cfg={cfg} score={score} ms={ms} what={`${deck.title} · ${title}`} />}
          </Results>
        }
      />
    );
  }

  const answer = item ? answerOf(item) : '';
  const asking = s.phase === 'ask';
  /** In a game of two, whose the question on screen is: it stays theirs until the next one comes. */
  const whose: Who = whoOf(Math.max(0, asking ? s.asked : s.asked - 1), first);
  /** The hint its game always had: a letter, the search narrowed, the map or the name. */
  const ownHint = (clicky || typed || mode === 'outline') && !unaided;
  /** The others that are still to be had: not the one that counts letters once some are in sight. */
  const offer = kinds.filter((k) => !help.used.includes(k) && !(k === 'count' && lettersShown > 0) && !(k === 'half' && choices.length < 4));
  /** A question with one other hint and no more has no menu to choose from: its button says which it is, and gives it. */
  const sole = kinds.length === 1 ? kinds[0] : null;
  /** One more hint, of the kind chosen: like any other, it makes the answer one given with help. */
  const more = (kind: HintKind) => {
    if (!item || !asking || unaided || !offer.includes(kind)) return;
    dispatch({ type: 'hint' });
    const said = kind === 'half' ? null : hintOf(kind, item, deck, answer, places);
    // Two of the three wrong options go, by the lot of this question: the same two to whoever plays the same game.
    const cut = kind === 'half' ? halve(choices.map((c) => c.id), item.id, mulberry32(seed + s.n * 104729)) : [];
    setHelp((h) => ({ ...h, open: false, used: [...h.used, kind], said: said ? [...h.said, said] : h.said, cut: [...h.cut, ...cut] }));
  };
  /** Escape shuts the menu and leaves the keyboard on the button that opened it. */
  const shut = (e: { key: string; stopPropagation: () => void }) => {
    if (e.key !== 'Escape' || !help.open) return;
    e.stopPropagation();
    setHelp((h) => ({ ...h, open: false }));
    box.current?.querySelector<HTMLElement>('.q-more-btn')?.focus();
  };
  /** A flag is asked about as the player chose: once answered it is seen as it is. */
  const look: FlagLook = asking ? (opts.flagLook ?? 'plain') : 'plain';
  const flagOf = (code: string | undefined) => (
    <span
      className={cx('q-flagbox', look !== 'plain' && `look-${look}`)}
      // Out of focus, it comes a little clearer with each try.
      style={look === 'blur' ? ({ '--flag-blur': `${FLAG_BLUR[Math.min(s.tries, FLAG_BLUR.length - 1)]}px` } as CSSProperties) : undefined}
    >
      <Flag code={code} size="xl" className="q-flag" />
    </span>
  );
  /** By ear the name is not read until the question is settled, unless the hint wrote it. */
  const unread = voiced && asking && help.main === 0;
  const question = (() => {
    if (!item) return null;
    const c = item.country;
    if (mode === 'pin') {
      if (pinBy === 'flag')
        return (
          <>
            <p className="kicker">{L('Señala el país de esta bandera', 'Pin the country of this flag')}</p>
            {flagOf(c.fl)}
          </>
        );
      if (pinBy === 'capital')
        return (
          <>
            <p className="kicker">{L('Señala el país cuya capital es', 'Pin the country whose capital is')}</p>
            <h2 className="q-name">{item.capital![0]}</h2>
          </>
        );
      if (unread)
        return (
          <>
            <p className="kicker">{L('Escucha y señala en el mapa', 'Listen and find it on the map')}</p>
            <SpeakButton key={item.id} text={item.name} label={L('Oír otra vez', 'Hear it again')} className="q-listen" />
            {several && (
              <p className="q-sub">
                <Flag code={c.fl} size="sm" /> {L(`${item.type} de ${nm(c.n)}`, `${item.type} in ${nm(c.n)}`)}
              </p>
            )}
          </>
        );
      return (
        <>
          <p className="kicker">{byEar ? L('Escucha y señala en el mapa', 'Listen and find it on the map') : L('Señala en el mapa', 'Find it on the map')}</p>
          <h2 className="q-name">
            {/* Once answered, the verdict below brings its own loudspeaker. */}
            {item.name} {s.phase === 'ask' && <SpeakButton key={item.id} text={item.name} />}
          </h2>
          {byEar && !voiced && <p className="q-sub">{L('Este navegador no tiene voz: aquí el nombre se lee.', 'This browser has no voice: here the name is read.')}</p>}
          {several && (
            <p className="q-sub">
              <Flag code={c.fl} size="sm" /> {L(`${item.type} de ${nm(c.n)}`, `${item.type} in ${nm(c.n)}`)}
            </p>
          )}
        </>
      );
    }
    if (mode === 'puzzle')
      return (
        <>
          <p className="kicker">{L('Puzle', 'Jigsaw')}</p>
          <h2 className="q-ask">{s.phase === 'ask' ? L('¿Dónde va esta pieza?', 'Where does this piece go?') : item.name}</h2>
          {piece && (
            <div className="piece">
              <svg viewBox="0 0 240 240" role="img" aria-label={L('Pieza que hay que colocar', 'Piece to place')}>
                <g transform={`translate(120 120) scale(${piece.k.toFixed(3)}) translate(-120 -120)`}>
                  <path d={piece.d} />
                </g>
              </svg>
            </div>
          )}
          {several && help.main > 0 && (
            <p className="q-sub">
              <Flag code={c.fl} size="sm" /> {L(`Es de ${nm(c.n)}`, `It belongs to ${nm(c.n)}`)}
            </p>
          )}
        </>
      );
    if (mode === 'identify')
      return (
        <>
          <p className="kicker">{L('Identifica', 'Identify')}</p>
          <h2 className="q-ask">{L(`¿Qué ${one} está ${fem ? 'resaltada' : 'resaltado'} en el mapa?`, `Which ${one} is highlighted on the map?`)}</h2>
        </>
      );
    if (mode === 'outline')
      return (
        <>
          <p className="kicker">{L('Silueta', 'Outline')}</p>
          <h2 className="q-ask">
            {L(`¿Qué ${one} tiene esta forma?`, `Which ${one} has this shape?`)}
            {opts.turned && asking && !showMap && <small> {L('Está girada: el norte no queda arriba.', 'It is turned: north is not at the top.')}</small>}
            {several && help.main > 0 && <small> {L(`Está en ${nm(c.n)}.`, `It is in ${nm(c.n)}.`)}</small>}
          </h2>
        </>
      );
    if (mode === 'parent') {
      const kind = item.belongs!.type;
      return (
        <>
          <p className="kicker">{item.kind === 'city' ? L(`¿En qué ${kind} está?`, `Which ${kind} is it in?`) : L(`¿A qué ${kind} pertenece?`, `Which ${kind} does it belong to?`)}</p>
          {/* No flag here: on a map of several countries it would be the answer. */}
          <h2 className="q-name">
            {item.name} {s.phase === 'ask' && <SpeakButton key={item.id} text={item.name} />}
          </h2>
        </>
      );
    }
    if (mode === 'capital')
      return (
        <>
          <p className="kicker">{L('¿Cuál es la capital de…?', 'What is the capital of…?')}</p>
          <h2 className="q-name">
            {(item.kind === 'country' || several) && <Flag code={c.fl} size="md" />} {item.name}
          </h2>
        </>
      );
    return (
      <>
        <p className="kicker">{L('¿De qué país es esta bandera?', 'Which country does this flag belong to?')}</p>
        {flagOf(c.fl)}
      </>
    );
  })();

  const turn = asking ? s.asked + 1 : s.asked;
  const verdictTitle =
    s.last === 'ok' ? (
      mode === 'pin' ? (
        L('¡Correcto!', 'Correct!')
      ) : (
        <>
          {mode === 'puzzle' ? L('¡Encaja!', 'It fits!') : L('¡Correcto!', 'Correct!')} <b>{answer}</b>
        </>
      )
    ) : s.last === 'warn' ? (
      <>
        {L('Bien, con ayuda:', 'Right, with help:')} <b>{answer}</b>
      </>
    ) : clicky ? (
      <>
        {L('Era aquí:', 'It was here:')} <b>{item?.name}</b>
      </>
    ) : (
      <>
        {L('Era', 'It was')} <b>{answer}</b>
      </>
    );

  const panel = (
    <div className="q" ref={box}>
      {s.round === 2 && <p className="q-round">{L(`Repaso de fallos · quedan ${s.queue.length + (asking ? 1 : 0)}`, `Reviewing misses · ${s.queue.length + (asking ? 1 : 0)} left`)}</p>}
      {duo && (duoUi ? <duoUi.DuoTurn names={players} who={whose} /> : duoLate && <p role="status">{L(`Turno de ${players[whose]}`, `${players[whose]}’s turn`)}</p>)}
      <div className="q-prompt">{question}</div>

      {/* Said aloud to whoever does not see them: the region is there, empty, before the first one comes. */}
      {asking && kinds.length > 0 && (
        <div className="q-said" aria-live="polite" tabIndex={-1}>
          {help.said.length > 0 && (
            <ul className="q-hints" aria-label={L('Pistas dadas', 'Hints given')}>
              {help.said.map((h) => (
                <li key={h.kind}>
                  <Lightbulb size={14} aria-hidden="true" />
                  <span>
                    {h.text}
                    {h.flag && <Flag code={h.flag} size="md" className="q-hint-flag" />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {asking && clicky && (
        <p className="q-how">
          <MapPin size={15} aria-hidden="true" /> {mode === 'puzzle' ? L('Haz clic en su sitio en el mapa.', 'Click where it goes on the map.') : L(`Haz clic en ${theOne}.`, `Click ${theOne}.`)}{' '}
          {/* In an exam every question has its one try: counting it down to nothing would say nothing. */}
          {exam ? L('El primer clic es tu respuesta.', 'Your first click is your answer.') : maxTries === 1 ? L('Solo hay un intento.', 'There is only one try.') : left(maxTries - s.tries)}
        </p>
      )}

      {!clicky && !typed && (
        <div className="choices" tabIndex={-1}>
          {choices.map((c, i) => {
            const isRight = !asking && c.id === item?.id;
            const isWrong = !asking && c.id === picked;
            /** Taken away by a hint: it stays where it was, struck out, so that the other two do not jump. */
            const out = asking && help.cut.includes(c.id);
            return (
              <button key={c.id} type="button" className={cx('choice', isRight && 'right', isWrong && 'wrong', out && 'out')} disabled={!asking || out} onClick={() => onChoice(c.id)}>
                <kbd>{i + 1}</kbd>
                <span>{answerOf(c)}</span>
              </button>
            );
          })}
        </div>
      )}

      {typed && asking && (
        <>
          <AnswerInput
            label={L('Tu respuesta', 'Your answer')}
            placeholder={mode === 'capital' ? L('Escribe la capital…', 'Type the capital…') : mode === 'parent' ? L('Escribe tu respuesta…', 'Type your answer…') : L(`Escribe ${theOne}…`, `Type ${theOne}…`)}
            onSubmit={onSubmit}
            suggest={suggest}
            shake={shake}
            clear={clear}
          />
          {mustType && s.asked === 0 && s.tries === 0 && s.hints === 0 && (
            <p className="q-note">
              {L(
                `Aquí la respuesta se escribe: entre cuatro opciones, las demás capitales se llaman como su ${one} y dejarían la buena a la vista.`,
                `Here the answer is typed: among four options, the other capitals are named after their ${one} and would leave the right one in plain sight.`,
              )}
            </p>
          )}
          {(lettersShown > 0 || help.used.includes('count')) && <p className="q-letters">{letterHint(answer, lettersShown)}</p>}
        </>
      )}

      {asking && note && (
        <p className="q-note" role="status">
          {note}
          {typed && !exam && ` ${left(maxTries - s.tries)}`}
        </p>
      )}

      {!asking && s.last && (
        <Verdict res={s.last} title={verdictTitle} item={item} wiki={opts.wiki && format !== 'timed'} say={answer}>
          {s.phase === 'reveal' && <p className="q-how">{L(`Haz clic en ${theOne} que parpadea para seguir.`, `Click the blinking ${one} to go on.`)}</p>}
          {spent && <p className="q-how">{L('Te has quedado sin vidas.', 'You are out of lives.')}</p>}
          {duo && duoUi && <duoUi.DuoGain names={players} who={whose} res={s.last} last={s.asked >= s.total} />}
        </Verdict>
      )}

      <div className="q-actions">
        {asking ? (
          <>
            {ownHint && (
              <button type="button" className="btn btn-sm" onClick={hint} disabled={clicky ? help.main > 0 : mode === 'outline' && !typed ? showMap : help.main >= hintMax(answer)}>
                <Lightbulb size={15} aria-hidden="true" />
                {voiced ? L('Ver el nombre', 'Show the name') : clicky ? L('Pista', 'Hint') : mode === 'outline' && (!showMap || !typed) ? L('Ver en el mapa', 'Show on the map') : L('Una letra', 'A letter')}
              </button>
            )}
            {offer.length > 0 && sole && (
              <button type="button" className="btn btn-sm q-more-btn" onClick={() => more(sole)}>
                {!ownHint && <Lightbulb size={15} aria-hidden="true" />}
                {hintLabel(sole)}
              </button>
            )}
            {offer.length > 0 && !sole && (
              <button type="button" className={cx('btn btn-sm q-more-btn', help.open && 'on')} aria-expanded={help.open} aria-controls="q-more" onClick={() => setHelp((h) => ({ ...h, open: !h.open }))} onKeyDown={shut}>
                {!ownHint && <Lightbulb size={15} aria-hidden="true" />}
                {ownHint ? L('Otra pista', 'Another hint') : L('Pista', 'Hint')}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={giveUp}>
              {exam ? L('Dejar en blanco', 'Leave it blank') : L('No lo sé', "I don't know")}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus={s.last !== 'ok'}>
            {spent ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => dispatch({ type: 'finish' })}>
          <FlagIcon size={15} aria-hidden="true" />
          {exam ? L('Entregar', 'Hand in') : L('Terminar', 'Finish')}
        </button>
      </div>

      {asking && help.open && !sole && offer.length > 0 && (
        <div className="q-more" id="q-more" role="group" aria-label={L('Otras pistas', 'Other hints')} onKeyDown={shut}>
          {offer.map((k) => (
            <button key={k} type="button" className="chip" onClick={() => more(k)}>
              {hintLabel(k)}
            </button>
          ))}
          <p>{L('Con cualquiera de ellas la respuesta cuenta como dada con ayuda.', 'With any of them the answer counts as given with help.')}</p>
        </div>
      )}
    </div>
  );

  return (
    <GameShell
      title={title}
      subtitle={subtitle}
      onExit={onExit}
      // Against the ghost, how far the game has got is said by its lane, beside the ghost's: the bar is drawn
      // only when there are no lanes, because there is no ghost after all or the code that draws them has not come.
      progress={racing && ghosts && rival ? undefined : format === 'timed' ? ms / limit : Number.isFinite(s.total) ? s.asked / s.total : undefined}
      // The two lanes take their room from the start, so that nothing moves when they come.
      under={
        duo ? (
          // The scoreboard of a game of two: its room is there from the start as well.
          <>{duoUi ? <duoUi.DuoBoard names={players} score={tallied} turn={whose} /> : duoLate && <p>{`${players[0]} ${tallied.of[0].pts} · ${players[1]} ${tallied.of[1].pts}`}</p>}</>
        ) : racing ? (
          <>{ghosts && rival !== undefined && <ghosts.GhostTrack rival={rival} trace={trace} total={s.total} ms={ms} />}</>
        ) : undefined
      }
      hud={
        format === 'timed' ? (
          <>
            <span className="hud-chip hud-main" title={L('Aciertos', 'Right answers')}>
              {s.ok}
            </span>
            <span className={cx('hud-chip hud-clock', timeLeft <= 10_000 && 'low')} title={L('Tiempo que queda', 'Time left')} role="timer">
              <Timer size={14} aria-hidden="true" />
              {fmtTime(timeLeft + 999)}
            </span>
          </>
        ) : format === 'lives' ? (
          <>
            <span className="hud-chip hud-main" title={L('Aciertos', 'Right answers')}>
              {s.ok}
            </span>
            <span className="hud-chip hud-lives" aria-label={L(`Vidas: ${lives} de ${rules.lives}`, `Lives: ${lives} of ${rules.lives}`)} title={L('Vidas', 'Lives')}>
              {Array.from({ length: rules.lives }, (_, i) => (
                <Heart key={i} size={14} className={i < lives ? 'on' : undefined} aria-hidden="true" />
              ))}
            </span>
          </>
        ) : (
          // The streak of an exam would say how each answer went. Against the ghost, the lanes say how far each
          // has got: one more count beside them, of the question in hand, would be one too many.
          <Hud
            ms={ms}
            // Nor is there a streak to show in a game of two: it would be of both.
            streak={exam || duo ? undefined : s.streak}
            progress={s.round === 2 ? L('Repaso', 'Review') : racing && ghosts && rival ? undefined : Number.isFinite(s.total) ? `${turn} / ${s.total}` : `${turn} · ${L('vuelta', 'lap')} ${s.lap}`}
          />
        )
      }
      panel={panel}
      stage={stage}
    />
  );
}
