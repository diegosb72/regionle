/** What the picture of the result of a game says: apart from its button, so that it can be told without a screen. */
import { L } from '../lib/i18n';
import type { CardInfo } from '../lib/shareCard';
import { fmtTime, nf } from '../lib/text';
import type { Res } from '../lib/types';
import { scoreOf } from './quiz';

export interface Tally {
  ok: number;
  warn: number;
  bad: number;
}

/**
 * `what` is the game ("Regiones · Señalar"), `where` its map ("España"), `verdict` the title of the result
 * and `day` the day it was played, written out.
 */
export function gameCard(what: string, where: string, verdict: string, count: Tally, ms: number | undefined, day: string, site: string): CardInfo {
  const total = count.ok + count.warn + count.bad;
  const rows: CardInfo['rows'] = [
    { name: L('A la primera', 'First time'), points: count.ok, of: total, tone: 'ok', text: nf(count.ok) },
    { name: L('Con ayuda', 'With help'), points: count.warn, of: total, tone: 'warn', text: nf(count.warn) },
    { name: L('Fallos', 'Misses'), points: count.bad, of: total, tone: 'bad', text: nf(count.bad) },
  ];
  if (ms != null) rows.push({ name: L('Tiempo', 'Time'), points: 0, text: fmtTime(ms), bar: false });
  return { kicker: what, country: where, total: scoreOf(count.ok, count.warn, total), unit: '%', verdict, rows, streak: day, site };
}

/** How the answer about each piece went, to paint the map: the worst of them when a piece was asked more than once. */
export function tonesOf(rows: readonly { item: { id: string }; res: Res }[]): Record<string, Res> {
  const worse: Record<Res, number> = { ok: 0, warn: 1, bad: 2 };
  const out: Record<string, Res> = {};
  for (const { item, res } of rows) if (!out[item.id] || worse[res] > worse[out[item.id]]) out[item.id] = res;
  return out;
}
