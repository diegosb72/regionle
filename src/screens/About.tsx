/** About the game: what is new, how to play with the keyboard, what is kept and where, and whose work it stands on. */
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { GameKeys, GlobalKeys } from '../components/KeyHelp';
import { RELEASES } from '../lib/changelog';
import { L, fmtDay, getLang } from '../lib/i18n';
import { REPO, reportUrl } from '../lib/report';
import { PROGRESS_PATH, RECEIPT_PATH } from '../lib/routes';
import { VERSION } from '../lib/version';


function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export function About() {
  const en = getLang() === 'en';
  const [latest, ...older] = RELEASES;
  return (
    <div className="about">
      <header className="about-head">
        <p className="kicker">{L('Acerca de', 'About')}</p>
        <h1>Regionle ∞</h1>
        <p className="about-lead">
          {L(
            'Un juego de geografía para aprender el mapa del mundo pieza a pieza: regiones, países, capitales, banderas, ciudades, ríos, mares y montañas. Sin registro, sin anuncios y sin límite de partidas.',
            'A geography game to learn the map of the world piece by piece: regions, countries, capitals, flags, cities, rivers, seas and mountains. No sign-up, no ads and no limit of games.',
          )}
        </p>
        <p className="about-version">
          {L('Versión', 'Version')} <b>{VERSION}</b> · {fmtDay(latest.date, true)} · <Out href={REPO}>{L('Código en GitHub', 'Code on GitHub')}</Out>
        </p>
        <p className="about-report">
          {L('¿Has visto algo que está mal: una capital, un nombre, una ciudad fuera de sitio?', 'Have you seen something wrong: a capital, a name, a city out of place?')}{' '}
          <Out href={reportUrl({ version: VERSION })}>{L('Avisar de un error', 'Report a mistake')}</Out>.{' '}
          {L(
            'Se abre un aviso en GitHub, ya rellenado (hace falta una cuenta). En una partida, cada respuesta trae su propio aviso, que dice además de qué pieza se trata.',
            'It opens a report on GitHub, already filled in (it takes an account). In a game, each answer has a report of its own, which also says which piece it is about.',
          )}
        </p>
      </header>

      <section className="about-block" aria-labelledby="about-new">
        <h2 id="about-new">{L('Novedades', 'What is new')}</h2>
        <h3 className="about-rel">
          {latest.version} <small>{fmtDay(latest.date, true)}</small>
        </h3>
        <ul className="about-list">
          {(en ? latest.en : latest.es).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <details className="about-older">
          <summary>{L('Versiones anteriores', 'Earlier versions')}</summary>
          {older.map((r) => (
            <div key={r.version}>
              <h3 className="about-rel">
                {r.version} <small>{fmtDay(r.date, true)}</small>
              </h3>
              <ul className="about-list">
                {(en ? r.en : r.es).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </section>

      <section className="about-block" aria-labelledby="about-keys">
        <h2 id="about-keys">{L('Con el teclado', 'With the keyboard')}</h2>
        <p>{L('Todo el juego se puede usar sin ratón ni pantalla táctil.', 'The whole game can be used without a mouse or a touch screen.')}</p>
        <h3 className="about-rel">{L('En cualquier pantalla', 'On any screen')}</h3>
        <GlobalKeys />
        <h3 className="about-rel">{L('En los juegos', 'In the games')}</h3>
        <GameKeys />
      </section>

      <section className="about-block" aria-labelledby="about-data">
        <h2 id="about-data">{L('Tus datos', 'Your data')}</h2>
        <p>
          {L(
            'Regionle no tiene cuentas, ni anuncios, ni contadores de visitas, ni servidor propio: es una página que funciona entera en tu navegador. No usa cookies.',
            'Regionle has no accounts, no ads, no visit counters and no server of its own: it is a page that runs entirely in your browser. It uses no cookies.',
          )}
        </p>
        <ul className="about-list">
          <li>
            <b>{L('Qué se guarda, y dónde.', 'What is kept, and where.')}</b>{' '}
            {L(
              'Tu progreso, tus resultados, tus fantasmas, tus ajustes, tus listas, el nombre que pongas en los retos y en las tareas, los de una partida a dos y los justificantes de tarea que hagas o abras se guardan en este navegador y solo en él. Los mapas que descargas para jugar sin conexión, también; y de un bingo, las piezas que han salido y las marcas de tu cartón.',
              'Your progress, your results, your ghosts, your settings, your lists, the name you put on challenges and on homework, those of a game of two and the homework receipts you make or open are kept in this browser and nowhere else. So are the maps you download to play without a connection; and of a bingo, the pieces that have come up and the marks on your card.',
            )}
          </li>
          <li>
            <b>{L('Qué sale de aquí.', 'What leaves it.')}</b>{' '}
            {L(
              'Solo lo que tú envías: el enlace de un reto o de una lista lleva dentro las preguntas, tu resultado y tu nombre; el justificante de una tarea, tu nombre, tu resultado y la fecha; la copia de seguridad, la tabla del repaso y la imagen del reto del día son archivos que guardas tú.',
              'Only what you send yourself: the link of a challenge or of a list carries the questions, your result and your name; the receipt of homework, your name, your result and the date; the backup, the table of the review and the picture of the daily challenge are files that you keep.',
            )}
          </li>
          <li>
            <b>{L('A quién se le pide algo.', 'Who is asked for anything.')}</b>{' '}
            {L(
              'La página se sirve desde GitHub Pages, que ve tu dirección IP como cualquier servidor web. La ficha que aparece al fallar se pide a Wikipedia y a Wikidata desde tu navegador (se quita en los ajustes de cada partida). Los enlaces a Wikipedia, OpenStreetMap y YouTube solo se abren si los pulsas. El botón de oír un nombre usa las voces del navegador, y algunos navegadores generan las suyas en sus propios servidores.',
              'The page is served from GitHub Pages, which sees your IP address as any web server does. The card shown after a miss is requested from Wikipedia and Wikidata by your browser (it can be turned off in the settings of each game). The links to Wikipedia, OpenStreetMap and YouTube only open if you press them. The button to hear a name uses the voices of the browser, and some browsers make theirs on their own servers.',
            )}
          </li>
          <li>
            <b>{L('Cómo se borra.', 'How to delete it.')}</b> {L('Con «Borrar progreso», en', 'With “Delete progress”, in')} <a href={`#/${PROGRESS_PATH}`}>{L('Progreso', 'Progress')}</a>
            {L(', o borrando los datos de este sitio en el navegador. Desde esa misma página se exporta y se importa.', ', or by clearing the data of this site in the browser. The same page exports and imports it.')}{' '}
            {L('Los justificantes de tarea no van en la copia, y se borran en', 'Homework receipts are not in the backup, and are deleted in')} <a href={`#/${RECEIPT_PATH}`}>{L('Justificantes abiertos aquí', 'Receipts opened here')}</a>.{' '}
            {L(
              'Lo de un bingo tampoco va en la copia: la partida se borra con «Empezar de nuevo» y las marcas de un cartón, con «Borrar las marcas».',
              'What a bingo keeps is not in the backup either: the game is deleted with “Start again”, and the marks on a card with “Clear the marks”.',
            )}
          </li>
        </ul>
      </section>

      <section className="about-block" aria-labelledby="about-src">
        <h2 id="about-src">{L('Fuentes y licencias', 'Sources and licences')}</h2>
        <dl className="about-src">
          <div>
            <dt>{L('Este juego', 'This game')}</dt>
            <dd>
              {L('Código libre:', 'Free software:')} <Out href={`${REPO}/blob/main/LICENSE`}>{L('licencia MIT', 'MIT licence')}</Out> ·{' '}
              {L('los datos de los mapas siguen las condiciones de sus fuentes, que son estas', 'the data of the maps keep the terms of their sources, which are these')}
            </dd>
          </div>
          <div>
            <dt>{L('Mapas, ciudades y geografía física', 'Maps, cities and physical geography')}</dt>
            <dd>
              <Out href="https://www.naturalearthdata.com/">Natural Earth</Out> · {L('dominio público', 'public domain')}
            </dd>
          </div>
          <div>
            <dt>{L('Ríos, embalses y relieve de España', 'Rivers, reservoirs and relief of Spain')}</dt>
            <dd>
              {L('Obra derivada de CartoBase ANE:', 'Derived from CartoBase ANE:')} <Out href="https://www.ign.es/web/ane-area-ane">Atlas Nacional de España (ANE)</Out> · CC BY 4.0 ign.es ·{' '}
              {L('a través de', 'through')} <Out href="https://github.com/rOpenSpain/mapSpain/tree/sianedata">rOpenSpain/mapSpain</Out>
            </dd>
          </div>
          <div>
            <dt>{L('Superficie de continentes y océanos, y los mares de cada océano', 'Surface of continents and oceans, and the seas of each ocean')}</dt>
            <dd>
              <Out href="https://www.cia.gov/the-world-factbook/">The World Factbook</Out> · {L('dominio público', 'public domain')} · {L('a través de', 'through')}{' '}
              <Out href="https://github.com/factbook/factbook.json">factbook/factbook.json</Out>
            </dd>
          </div>
          <div>
            <dt>{L('Población', 'Population')}</dt>
            <dd>
              {L('Banco Mundial, a través de', 'World Bank, through')} <Out href="https://github.com/datasets/population">datasets/population</Out> · ODC-PDDL
            </dd>
          </div>
          <div>
            <dt>{L('Capitales, superficies y otros datos de países', 'Capitals, areas and other country data')}</dt>
            <dd>
              <Out href="https://www.geonames.org/">GeoNames</Out> · CC BY 4.0
            </dd>
          </div>
          <div>
            <dt>{L('Abreviaturas y variantes de las regiones', 'Short forms and spellings of the regions')}</dt>
            <dd>
              {L('Los type-ins del quiz de JetPunk', 'The type-ins of the JetPunk quiz')}{' '}
              <Out href="https://www.jetpunk.com/user-quizzes/309965/all-first-level-subdivisions-of-the-world-with-a-map">ALL First-Level Subdivisions of the World With a Map</Out>
              {L(', de Vicky', ', by Vicky')}
            </dd>
          </div>
          <div>
            <dt>{L('Banderas', 'Flags')}</dt>
            <dd>
              <Out href="https://github.com/lipis/flag-icons">flag-icons</Out> · MIT
            </dd>
          </div>
          <div>
            <dt>{L('Resúmenes y fotos de la ficha', 'Summaries and pictures of the card')}</dt>
            <dd>
              <Out href="https://www.wikipedia.org/">Wikipedia</Out> {L('y', 'and')} <Out href="https://www.wikidata.org/">Wikidata</Out> · {L('textos', 'texts')} CC BY-SA 4.0
            </dd>
          </div>
          <div>
            <dt>{L('Tipografías', 'Typefaces')}</dt>
            <dd>
              Fraunces {L('y', 'and')} DM Sans · SIL Open Font License 1.1 · <Out href="https://fontsource.org/">Fontsource</Out>
            </dd>
          </div>
          <div>
            <dt>{L('Iconos', 'Icons')}</dt>
            <dd>
              <Out href="https://lucide.dev/">Lucide</Out> · ISC
            </dd>
          </div>
          <div>
            <dt>{L('Programa', 'Software')}</dt>
            <dd>React, Zustand · MIT · D3, TopoJSON · ISC</dd>
          </div>
        </dl>
        <p className="tip-line">
          {L('La idea original es de', 'The original idea is that of')} <Out href="https://regionle.xyz">regionle.xyz</Out>
          {L('; este proyecto no usa su código ni sus datos. ', '; this project uses neither its code nor its data. ')}
          {L('Las fronteras y los nombres son los de las fuentes y no suponen ninguna toma de postura.', 'Borders and names are those of the sources and imply no position on any dispute.')}
        </p>
      </section>
    </div>
  );
}
