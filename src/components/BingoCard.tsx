/**
 * A card of a bingo (lib/bingo.ts): its names in a square. The same card is what a player marks on a phone,
 * what the screen that calls shows when a card is checked, and what goes to paper.
 */
import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { linesOf, tightOf } from '../lib/bingo';
import { L } from '../lib/i18n';
import { cx } from '../lib/text';
import './bingo.css';

export function BingoCard({
  names,
  size,
  label,
  marked,
  lines,
  onMark,
}: {
  /** The names of its pieces, row after row. */
  names: readonly string[];
  size: number;
  /** What it is, for whoever does not see it: "Cartón 7". */
  label: string;
  /** Which cells are marked; none when it is not said. */
  marked?: readonly boolean[];
  /** The lines that are complete, as their places in `linesOf`: their cells are drawn as part of one. */
  lines?: readonly number[];
  /** With it, each cell is a button that marks it or takes the mark away. */
  onMark?(cell: number): void;
}) {
  const all = linesOf(size);
  const inLine = new Set((lines ?? []).flatMap((i) => all[i]));
  const rows = Array.from({ length: size }, (_, r) => r);
  return (
    <div className="bcard" role="table" aria-label={label} style={{ '--n': size } as CSSProperties}>
      {rows.map((r) => (
        <div key={r} role="row" className="bcard-row">
          {rows.map((c) => {
            const cell = r * size + c;
            const name = names[cell];
            const on = !!marked?.[cell];
            const cls = cx('bcell', `t${tightOf(name)}`, on && 'on', inLine.has(cell) && 'in-line');
            const inside = (
              <>
                <span className="bcell-name">{name}</span>
                {on && <Check className="bcell-mark" size={14} aria-hidden="true" />}
              </>
            );
            return (
              <div key={c} role="cell" className="bcard-cell">
                {onMark ? (
                  <button type="button" className={cls} aria-pressed={on} onClick={() => onMark(cell)}>
                    {inside}
                  </button>
                ) : (
                  <span className={cls}>
                    {inside}
                    {on && <span className="sr-only"> {L('(ha salido)', '(it has come out)')}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
