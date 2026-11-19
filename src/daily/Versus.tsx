/**
 * The daily challenge set beside the results others sent by link: who sent theirs, before the challenge is
 * played, and everybody in order once it is finished, test by test.
 */
import { X } from 'lucide-react';
import { L } from '../lib/i18n';
import { useStore } from '../lib/store';
import { cx, listed } from '../lib/text';
import { testName } from './Card';
import { TESTS, type DailyRec } from './spec';
import { bestOf, ranking, type Row } from './versus';

const unnamed = (n: number, of: number): string => (of > 1 ? L(`Rival ${n}`, `Rival ${n}`) : L('Tu rival', 'Your rival'));
const points = (n: number): string => L(n === 1 ? '1 punto' : `${n} puntos`, n === 1 ? '1 point' : `${n} points`);
/** "1.º", "2.º" · "1st", "2nd". */
const ordinal = (n: number): string => L(`${n}.º`, `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`);

/** How it went, in a line: against one, who won and by how much; among several, one's place. */
function verdict(rows: readonly Row[]): { text: string; tone: 'won' | 'lost' | 'tie' } {
  const me = rows.find((r) => r.me)!;
  const others = rows.filter((r) => !r.me);
  if (others.length === 1) {
    const [other] = others;
    const by = Math.abs(me.total - other.total);
    if (!by) return { text: L(`¡Empate con ${other.name}!`, `A tie with ${other.name}!`), tone: 'tie' };
    return me.total > other.total
      ? { text: L(`¡Has ganado a ${other.name} por ${points(by)}!`, `You beat ${other.name} by ${points(by)}!`), tone: 'won' }
      : { text: L(`Gana ${other.name} por ${points(by)}`, `${other.name} wins by ${points(by)}`), tone: 'lost' };
  }
  const level = rows.filter((r) => r.place === me.place).length > 1;
  const place = L(`${level ? 'Empatas en el' : 'Eres'} ${ordinal(me.place)} de ${rows.length}`, `${level ? 'You are level in' : 'You are'} ${ordinal(me.place)} of ${rows.length}`);
  if (me.place === 1) return { text: `${L('¡', '')}${place}!`, tone: level ? 'tie' : 'won' };
  return { text: L(`${place}, a ${points(rows[0].total - me.total)} de ${rows[0].name}`, `${place}, ${points(rows[0].total - me.total)} behind ${rows[0].name}`), tone: 'lost' };
}

/** Before the challenge is finished: who sent their result, and the total to beat. */
export function VersusNote({ date }: { date: string }) {
  const rivals = useStore((s) => s.rivals[date]);
  if (!rivals?.length) return null;
  const rows = ranking(null, rivals, unnamed);
  const top = rows[0];
  return (
    <p className="d-vs-note" role="status">
      {rows.length === 1
        ? L(`${top.name} ha hecho ${points(top.total)} en este reto. Juégalo y os comparáis al final.`, `${top.name} scored ${points(top.total)} in this challenge. Play it and compare at the end.`)
        : L(
            `${listed(rows.map((r) => r.name), 'y')} te han enviado su resultado de este reto: el mejor, ${points(top.total)}. Juégalo y os comparáis al final.`,
            `${listed(rows.map((r) => r.name), 'and')} sent you their results of this challenge: the best, ${points(top.total)}. Play it and compare at the end.`,
          )}
    </p>
  );
}

/** Once it is finished: everybody in order, with the points of each test. */
export function Versus({ date, rec }: { date: string; rec: DailyRec }) {
  const rivals = useStore((s) => s.rivals[date]);
  const dropRival = useStore((s) => s.dropRival);
  if (!rivals?.length) return null;
  const rows = ranking(rec.p, rivals, unnamed);
  const best = bestOf(rows);
  const { text, tone } = verdict(rows);
  return (
    <section className={cx('d-vs', tone)} aria-label={L('Comparación', 'Comparison')}>
      <h3>{L('Cara a cara', 'Head to head')}</h3>
      <p className="d-vs-verdict">{text}</p>
      <div className="d-vs-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{L('Quién', 'Who')}</span>
              </th>
              <th scope="col">{L('Total', 'Total')}</th>
              {Array.from({ length: TESTS }, (_, i) => (
                <th key={i} scope="col">
                  <abbr title={testName(i)}>{i + 1}</abbr>
                </th>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.index} className={cx(row.me && 'me')}>
                <th scope="row">
                  <div className="d-vs-who">
                    <i aria-hidden="true">{row.place}</i>
                    <span title={row.me ? undefined : row.name}>{row.me ? L('Tú', 'You') : row.name}</span>
                  </div>
                </th>
                <td className="d-vs-total">{row.total}</td>
                {row.p.map((p, i) => (
                  <td key={i} className={cx(p === best[i] && 'is-top')}>
                    {p}
                  </td>
                ))}
                <td>
                  {!row.me && (
                    <button type="button" className="d-vs-drop" onClick={() => dropRival(date, row.index)} aria-label={L(`Quitar a ${row.name}`, `Remove ${row.name}`)} title={L('Quitar', 'Remove')}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="d-hint">
        {Array.from({ length: TESTS }, (_, i) => `${i + 1} ${testName(i)}`).join(' · ')}
        {L('. En negrita, lo mejor de cada prueba.', '. In bold, the best of each test.')}
      </p>
    </section>
  );
}
