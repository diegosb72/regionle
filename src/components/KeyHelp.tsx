/**
 * The keys of the game, written out: those that work on any screen and those of the games. The screen
 * "Acerca de" shows both lists, and so does the panel that the key "?" opens from anywhere.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { L } from '../lib/i18n';
import { SECTIONS } from '../lib/modes';
import { SHORTCUT_KEYS } from '../lib/shortcuts';
import { useStore } from '../lib/store';
import { Toggle } from './ui';

/**
 * The arrow keys are drawn, not written: the typeface of the page has the up and down arrows and not
 * the left and right ones, which would come from whatever other font the device has, or from none.
 */
const ARROWS = {
  '←': { Icon: ArrowLeft, name: () => L('Flecha izquierda', 'Left arrow') },
  '↑': { Icon: ArrowUp, name: () => L('Flecha arriba', 'Up arrow') },
  '→': { Icon: ArrowRight, name: () => L('Flecha derecha', 'Right arrow') },
  '↓': { Icon: ArrowDown, name: () => L('Flecha abajo', 'Down arrow') },
} as const;

function Keys({ children }: { children: string }) {
  return (
    <>
      {children.split(' ').map((k, i) => {
        const arrow = k in ARROWS ? ARROWS[k as keyof typeof ARROWS] : null;
        return arrow ? (
          <kbd key={i}>
            <arrow.Icon size={14} strokeWidth={2.4} aria-hidden="true" />
            <span className="sr-only">{arrow.name()}</span>
          </kbd>
        ) : (
          <kbd key={i}>{k}</kbd>
        );
      })}
    </>
  );
}

/** The keys that work on any screen, and the switch that turns them off. */
export function GlobalKeys() {
  const hotkeys = useStore((s) => s.hotkeys);
  const setHotkeys = useStore((s) => s.setHotkeys);
  const first = SHORTCUT_KEYS.sections[0];
  const last = SHORTCUT_KEYS.sections[SHORTCUT_KEYS.sections.length - 1];
  return (
    <>
      <dl className={hotkeys ? 'about-keys' : 'about-keys keys-off'}>
        <div>
          <dt>
            <kbd>{first.key}</kbd>
            <span aria-hidden="true">–</span>
            <span className="sr-only">{L('a', 'to')}</span>
            <kbd>{last.key}</kbd>
          </dt>
          <dd>
            {L('Abren una sección', 'They open a section')}: {SHORTCUT_KEYS.sections.map((s) => `${s.key} ${SECTIONS[s.section].name}`).join(', ')}.
          </dd>
        </div>
        <div>
          <dt>
            <kbd>{SHORTCUT_KEYS.daily}</kbd>
          </dt>
          <dd>{L('El reto del día.', 'The daily challenge.')}</dd>
        </div>
        <div>
          <dt>
            <kbd>{SHORTCUT_KEYS.progress}</kbd>
          </dt>
          <dd>{L('Tu progreso.', 'Your progress.')}</dd>
        </div>
        <div>
          <dt>
            <kbd>{SHORTCUT_KEYS.theme}</kbd>
          </dt>
          <dd>{L('Cambia el tema: claro, oscuro o el del sistema.', 'Switches the theme: light, dark or your system’s.')}</dd>
        </div>
        <div>
          <dt>
            <kbd>{SHORTCUT_KEYS.help}</kbd>
          </dt>
          <dd>{L('Enseña esta lista desde cualquier pantalla, también durante una partida.', 'Shows this list from any screen, during a game too.')}</dd>
        </div>
      </dl>
      <div className="keys-switch">
        <Toggle
          checked={hotkeys}
          onChange={setHotkeys}
          hint={L(
            'Son teclas sueltas, sin Ctrl ni Alt. No hacen nada mientras escribes, mientras recorres un mapa con las flechas ni durante una partida, salvo esta lista. Si te estorban (con un programa de dictado, por ejemplo), apágalas.',
            'They are single keys, with no Ctrl or Alt. They do nothing while you type, while you move around a map with the arrow keys or during a game, except for this list. If they get in your way (with dictation software, for instance), turn them off.',
          )}
        >
          {L('Atajos de una tecla', 'One-key shortcuts')}
        </Toggle>
      </div>
    </>
  );
}

/** The keys of the games: the map, the answers and the options. */
export function GameKeys() {
  return (
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
            'En un mapa en el que hay que elegir una pieza (Señalar, Puzle, Aprender, el reto del día…), llevan el cursor a la pieza vecina por ese lado. Donde se marca un punto (Situar a ciegas, Caliente y frío, Coordenadas, la regla de Explorar) mueven una cruz; con Mayús, a pasos cortos.',
            'On a map where a piece has to be chosen (Pin it, Jigsaw, Learn, the daily challenge…), they take the cursor to the next piece on that side. Where a spot is marked (Place it blind, Hot and cold, Coordinates, the ruler of Explore) they move a cross; with Shift, in short steps.',
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
            'En el mapa, elige la pieza del cursor o deja el punto bajo la cruz (también Espacio). Después de una respuesta, pasa a la pregunta siguiente. Al escribir, envía la respuesta. En «Marca el grupo», en el mapa marca o desmarca la pieza y, fuera de él, comprueba lo marcado.',
            'On the map, it chooses the piece under the cursor or drops the spot under the cross (Space too). After an answer, it moves on to the next question. When typing, it sends the answer. In “Mark the group”, on the map it marks or unmarks the piece and, off it, it checks what is marked.',
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
          <Keys>8 6 2 4</Keys>
        </dt>
        <dd>
          {L(
            'En «Distancias y rumbos», eligen el rumbo como están en un teclado numérico: 8 norte, 6 este, 2 sur y 4 oeste; 7, 9, 3 y 1, los intermedios.',
            'In “Distances and bearings”, they choose the bearing as they lie on a numeric keypad: 8 north, 6 east, 2 south and 4 west; 7, 9, 3 and 1, the ones in between.',
          )}
        </dd>
      </div>
      <div>
        <dt>
          <Keys>{L('Espacio 1 2 3', 'Space 1 2 3')}</Keys>
        </dt>
        <dd>
          {L(
            'En «Tarjetas», Espacio (o Intro) da la vuelta a la tarjeta; después, 1, 2 y 3 dicen «No lo sabía», «Casi» y «Lo sabía».',
            'In “Flashcards”, Space (or Enter) turns the card over; then 1, 2 and 3 say “I did not know”, “Nearly” and “I knew it”.',
          )}
        </dd>
      </div>
      <div>
        <dt>
          <Keys>↑ ↓</Keys>
        </dt>
        <dd>{L('En «Mayor o menor», responden más o menos. En un campo de respuesta con sugerencias, las recorren; Esc las cierra.', 'In “Higher or lower”, they answer more or less. In an answer field with suggestions, they go through them; Esc closes them.')}</dd>
      </div>
    </dl>
  );
}

/**
 * The panel of keys, over whatever screen is shown. It is a dialog of the browser: it keeps the focus
 * inside while it is open, Esc closes it and the focus goes back to where it was.
 */
export function KeysDialog({ onClose }: { onClose(): void }) {
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = box.current;
    if (!d) return;
    if (d.open) return;
    // An old browser without dialogs shows it in the page, which is still the list that was asked for.
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);
  // Every way out goes through the dialog's own closing, which is what gives the focus back to where it
  // was; the panel is taken away when the dialog says it has closed.
  const shut = () => {
    const d = box.current;
    if (d?.open && typeof d.close === 'function') d.close();
    else onClose();
  };
  return (
    <dialog
      ref={box}
      className="keys-dialog"
      aria-labelledby="keys-title"
      onClose={onClose}
      // A key pressed in the panel is not one for the game behind it, which listens on the window.
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        // A click on the darkened page around the panel closes it.
        if (e.target === box.current) shut();
      }}
    >
      <div className="keys-box">
        <header>
          <h2 id="keys-title">{L('Atajos de teclado', 'Keyboard shortcuts')}</h2>
          <button type="button" className="icon-btn" onClick={shut} aria-label={L('Cerrar', 'Close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <h3>{L('En cualquier pantalla', 'On any screen')}</h3>
        <GlobalKeys />
        <h3>{L('En los juegos', 'In the games')}</h3>
        <GameKeys />
      </div>
    </dialog>
  );
}
