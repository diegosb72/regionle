/** About the game: what is new, how to play with the keyboard, what is kept and where, and whose work it stands on. */
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { RELEASES } from '../lib/changelog';
import { L, fmtDay, getLang } from '../lib/i18n';
import { PROGRESS_PATH } from '../lib/routes';
import { VERSION } from '../lib/version';

const REPO = 'https://github.com/diegosb72/regionle';

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function Keys({ children }: { children: string }) {
  return (
    <>
      {children.split(' ').map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </>
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
        <dl className="about-keys">
          <div>
            <dt>
              <Keys>Tab</Keys>
            </dt>
            <dd>{L('Pasa al botón, enlace o campo siguiente; con Mayús, al anterior. Intro o Espacio lo pulsan.', 'Moves to the next button, link or field; with Shift, to the one before. Enter or Space press it.')}</dd>
          </div>
          <div>
            <dt>
              <Keys>← ↑ → ↓</Keys>
            </dt>
            <dd>
              {L(
                'En un mapa en el que hay que elegir una pieza (Señalar, Puzle, Aprender, el reto del día…), llevan el cursor a la pieza vecina por ese lado. Donde se marca un punto (Situar a ciegas) mueven una cruz; con Mayús, a pasos cortos.',
                'On a map where a piece has to be chosen (Pin it, Jigsaw, Learn, the daily challenge…), they take the cursor to the next piece on that side. Where a spot is marked (Place it blind) they move a cross; with Shift, in short steps.',
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Keys>{L('AvPág RePág', 'PgDn PgUp')}</Keys>
            </dt>
            <dd>
              {L(
                'En esos mismos mapas, pasan a la pieza siguiente o a la anterior, de oeste a este; Inicio y Fin van a la primera y a la última.',
                'On those same maps, they go to the next piece or to the one before, from west to east; Home and End go to the first and to the last.',
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Keys>{L('Intro', 'Enter')}</Keys>
            </dt>
            <dd>
              {L(
                'En el mapa, elige la pieza del cursor o deja el punto bajo la cruz (también Espacio). Después de una respuesta, pasa a la pregunta siguiente. Al escribir, envía la respuesta.',
                'On the map, it chooses the piece under the cursor or drops the spot under the cross (Space too). After an answer, it moves on to the next question. When typing, it sends the answer.',
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Keys>+ − 0</Keys>
            </dt>
            <dd>{L('Con el mapa enfocado, acercan, alejan y vuelven a enseñarlo entero.', 'With the map focused, they zoom in, zoom out and show the whole of it again.')}</dd>
          </div>
          <div>
            <dt>
              <Keys>1 2 3 4</Keys>
            </dt>
            <dd>{L('Eligen entre las cuatro opciones, cuando la respuesta no se escribe.', 'They choose among the four options, when the answer is not typed.')}</dd>
          </div>
          <div>
            <dt>
              <Keys>↑ ↓</Keys>
            </dt>
            <dd>{L('En «Mayor o menor», responden más o menos. En un campo de respuesta con sugerencias, las recorren; Esc las cierra.', 'In “Higher or lower”, they answer more or less. In an answer field with suggestions, they go through them; Esc closes them.')}</dd>
          </div>
        </dl>
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
              'Tu progreso, tus resultados, tus ajustes, tus listas y el nombre que pongas en los retos se guardan en este navegador y solo en él. Los mapas que descargas para jugar sin conexión, también.',
              'Your progress, your results, your settings, your lists and the name you put on challenges are kept in this browser and nowhere else. So are the maps you download to play without a connection.',
            )}
          </li>
          <li>
            <b>{L('Qué sale de aquí.', 'What leaves it.')}</b>{' '}
            {L(
              'Solo lo que tú envías: el enlace de un reto o de una lista lleva dentro las preguntas, tu resultado y tu nombre, y la copia de seguridad es un archivo que guardas tú.',
              'Only what you send yourself: the link of a challenge or of a list carries the questions, your result and your name, and the backup is a file that you keep.',
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
            {L(', o borrando los datos de este sitio en el navegador. Desde esa misma página se exporta y se importa.', ', or by clearing the data of this site in the browser. The same page exports and imports it.')}
          </li>
        </ul>
      </section>

      <section className="about-block" aria-labelledby="about-src">
        <h2 id="about-src">{L('Fuentes y licencias', 'Sources and licences')}</h2>
        <dl className="about-src">
          <div>
            <dt>{L('Mapas, ciudades y geografía física', 'Maps, cities and physical geography')}</dt>
            <dd>
              <Out href="https://www.naturalearthdata.com/">Natural Earth</Out> · {L('dominio público', 'public domain')}
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
