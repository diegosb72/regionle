/**
 * The result of a game as a picture to save or to send: what was played and where, the score, how many
 * answers were right at once, helped or missed, the time, and the map with each piece painted by how its
 * answer went. Fetched when a game ends: no game carries the drawing with it.
 */
import { useMemo } from 'react';
import { SharePicture } from '../components/SharePicture';
import { BASE } from '../components/ui';
import { L, fmtDay } from '../lib/i18n';
import { MODE_NAME, SECTIONS } from '../lib/modes';
import { siteRoot } from '../lib/routes';
import { siteLabel } from '../lib/shareCard';
import { useStore } from '../lib/store';
import { fmtTime, nf, today } from '../lib/text';
import type { Deck } from '../lib/types';
import type { ResultRow } from './common';
import { gameCard, tonesOf, type Tally } from './resultCard';

export function ResultPicture({ verdict, deck, rows, count, ms }: { verdict: string; deck?: Deck; rows: ResultRow[]; count: Tally; ms?: number }) {
  const game = useStore((s) => s.game);
  const mode = game ? MODE_NAME[game.mode] : '';
  const what = [game ? SECTIONS[game.section].name : '', mode].filter(Boolean).join(' · ');
  // With no map to name (a game of figures), the game itself is the name.
  const where = deck?.title || mode || 'Regionle';
  const day = today();
  const info = gameCard(deck?.title ? what : game ? SECTIONS[game.section].name : '', where, verdict, count, ms, fmtDay(day, true), siteLabel());
  const tones = useMemo(() => tonesOf(rows), [rows]);
  const only = deck?.countries.length === 1 ? deck.countries[0] : null;
  const total = count.ok + count.warn + count.bad;
  const text = [
    `Regionle ∞ · ${what}`,
    `${deck?.title ? `${deck.title}: ` : ''}${info.total} % · ${L(`${nf(count.ok)} de ${nf(total)} a la primera`, `${nf(count.ok)} of ${nf(total)} first time`)}${ms != null ? ` · ${fmtTime(ms)}` : ''}`,
    siteRoot(),
  ].join('\n');
  return (
    <SharePicture
      info={info}
      flagUrl={only?.fl ? `${BASE}flags/${only.fl}.svg` : undefined}
      deck={deck ?? null}
      tones={tones}
      file={`regionle-${game?.mode ?? 'partida'}-${day}.png`}
      text={text}
      failed={L('No se ha podido crear la imagen.', 'The picture could not be made.')}
    />
  );
}
