/** The album of flags, on the Progress page: a page for each continent and a place for each flag, filled once it is learnt. */
import { ArrowRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { albumOf, missingOf, type AlbumPage } from '../lib/album';
import { L } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { nf, shuffle } from '../lib/text';
import type { World } from '../lib/world';
import { Flag } from './ui';
import './album.css';

/** Flags asked in a game started from a page: enough for a sitting, the rest stays for the next one. */
const ALBUM_GAME = 20;

export function AlbumBlock({ world }: { world: World }) {
  const stats = useStore((s) => s.stats);
  const kept = useStore((s) => s.album);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const album = useMemo(() => albumOf(world.index, kept, stats, L('Otros territorios', 'Other territories')), [world, kept, stats]);
  const [open, setOpen] = useState(false);
  const pagesId = useId();

  /** A game of flags with the ones the page lacks, drawn by lot when they are many. */
  const play = (page: AlbumPage) => {
    const ids = shuffle(missingOf(page)).slice(0, ALBUM_GAME);
    start({ section: 'countries', mode: 'flag', countries: ids, levels: {}, opts: { ...opts, length: 'all' }, only: ids });
    go('jugar');
  };

  return (
    <section className="block album">
      <h2>{L('Álbum de banderas', 'Flag album')}</h2>
      <p className="tip-line">
        {L(
          `Llevas ${nf(album.got)} de las ${nf(album.total)} banderas de los países del mundo. Una bandera entra en el álbum cuando la aprendes (dos aciertos seguidos a la primera en «${MODE_NAME.flag}» o en las tarjetas) y ya no sale, aunque luego la falles.`,
          `You have ${nf(album.got)} of the ${nf(album.total)} flags of the countries of the world. A flag goes into the album once you learn it (right first time twice in a row in “${MODE_NAME.flag}” or on the flashcards) and stays there, even if you miss it later.`,
        )}
      </p>
      <ul className="album-pages">
        {album.pages.map((p) => (
          <li key={p.id}>
            <span>
              <b>{p.name}</b>
              <small>
                {nf(p.got)} / {nf(p.stickers.length)}
              </small>
            </span>
            <div className="bar" role="img" aria-label={L(`${p.name}: ${p.got} de ${p.stickers.length} banderas`, `${p.name}: ${p.got} of ${p.stickers.length} flags`)}>
              <i style={{ width: `${(p.got / p.stickers.length) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-sm album-open" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={pagesId}>
        {open ? L('Cerrar el álbum', 'Close the album') : L('Abrir el álbum', 'Open the album')}
      </button>
      <div id={pagesId} className="album-book" hidden={!open}>
        {open &&
          album.pages.map((p) => {
            const missing = p.stickers.length - p.got;
            return (
              <section key={p.id} className="album-page" aria-label={p.name} data-page={p.id}>
                <header>
                  <h3>
                    {p.name}{' '}
                    <small>
                      {L(`${nf(p.got)} de ${nf(p.stickers.length)}`, `${nf(p.got)} of ${nf(p.stickers.length)}`)}
                    </small>
                  </h3>
                  {missing > 0 ? (
                    <button type="button" className="btn btn-sm" onClick={() => play(p)}>
                      {missing <= ALBUM_GAME
                        ? L(missing === 1 ? 'Jugar la que falta' : `Jugar las ${missing} que faltan`, missing === 1 ? 'Play the missing one' : `Play the ${missing} missing`)
                        : L(`Jugar ${ALBUM_GAME} de las que faltan`, `Play ${ALBUM_GAME} of the missing`)}
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="album-full">{L('Página completa', 'Page complete')}</span>
                  )}
                </header>
                <ul className="album-grid">
                  {p.stickers.map((s) => (
                    <li key={s.id} className={s.got ? 'got' : undefined} data-id={s.id}>
                      {s.got ? <Flag code={s.flag} /> : <span className="album-slot" aria-hidden="true" />}
                      <span>
                        {s.name}
                        {!s.got && <span className="sr-only">{L(' (falta)', ' (missing)')}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
    </section>
  );
}
