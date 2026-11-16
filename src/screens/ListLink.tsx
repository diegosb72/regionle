/** A custom list received by link: what it holds, and the way to keep it and play it. */
import { ArrowLeft, ListChecks, Play } from 'lucide-react';
import { useMemo } from 'react';
import { Flag } from '../components/ui';
import type { World } from '../lib/data';
import { countriesOf, describeMap } from '../lib/describe';
import { L } from '../lib/i18n';
import { decodeList, sameList } from '../lib/lists';
import { PATHS, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { nf } from '../lib/text';

export function ListLink({ code, world }: { code: string; world: World }) {
  const lists = useStore((s) => s.lists);
  const saveList = useStore((s) => s.saveList);
  const setListOn = useStore((s) => s.setListOn);
  const list = useMemo(() => decodeList(code), [code]);
  const countries = useMemo(() => (list ? countriesOf(list, world) : []), [list, world]);
  const valid = !!list && (list.section === 'physical' || countries.length > 0);

  if (!valid || !list) {
    return (
      <div className="duel-page">
        <p className="kicker">{L('Lista a medida', 'Custom list')}</p>
        <h1>{L('Este enlace no funciona', 'This link does not work')}</h1>
        <p className="lead">{L('Puede que se haya cortado al copiarlo. Pide que te lo envíen otra vez o crea tu propia lista.', 'It may have been cut when it was copied. Ask for it again, or make a list of your own.')}</p>
        <a className="btn btn-primary" href="#/">
          <ArrowLeft size={16} aria-hidden="true" />
          {L('Ir al inicio', 'Go to the home page')}
        </a>
      </div>
    );
  }

  const name = list.name || L('Lista sin nombre', 'Unnamed list');
  /** The same list, if it was already kept: opening a link twice must not leave two copies. */
  const have = lists.find((l) => sameList(l, list));
  const accept = () => {
    const id = have?.id ?? list.id;
    if (!have) saveList({ ...list, name, countries: list.section === 'physical' ? list.countries : countries.map((c) => c.id) });
    setListOn(list.section, id);
    go(PATHS[list.section]);
  };

  return (
    <div className="duel-page">
      <p className="kicker">
        <ListChecks size={15} aria-hidden="true" /> {L('Lista a medida', 'Custom list')}
      </p>
      <h1>{L(`Te han pasado la lista «${name}»`, `You have been sent the list “${name}”`)}</h1>
      <div className="duel-what">
        {countries.length > 0 && (
          <span className="duel-flags" aria-hidden="true">
            {countries.slice(0, 8).map((c) => (
              <Flag key={c.id} code={c.fl} size="md" />
            ))}
          </span>
        )}
        <strong>{L(`${nf(list.ids.length)} piezas`, `${nf(list.ids.length)} pieces`)}</strong>
        <span>
          {SECTIONS[list.section].name} · {describeMap(list, world)}
        </span>
      </div>
      <p className="duel-rules">
        {have
          ? L(`Ya la tienes guardada${have.name !== name ? ` como «${have.name}»` : ''}. Elige el modo de juego en la pantalla siguiente.`, `You already have it${have.name !== name ? ` as “${have.name}”` : ''}. Choose the game mode on the next screen.`)
          : L('Se guarda en este dispositivo, junto a tus listas. En la pantalla siguiente eliges el modo de juego: señalar, identificar, rellenar el mapa…', 'It is kept on this device, with your lists. On the next screen you choose the game mode: pin it, identify, fill the map…')}
      </p>
      <div className="duel-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={accept} autoFocus>
          <Play size={18} aria-hidden="true" />
          {have ? L('Jugar con la lista', 'Play the list') : L('Guardar y jugar', 'Save and play')}
        </button>
        <a className="btn btn-ghost" href="#/">
          {L('Ahora no', 'Not now')}
        </a>
      </div>
    </div>
  );
}
