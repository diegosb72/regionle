/** An address that is nothing in the game: it says so and offers every way on. */
import { ArrowRight } from 'lucide-react';
import { L } from '../lib/i18n';
import { SECTIONS, SECTION_IDS } from '../lib/modes';
import { DAILY_PATH, PROGRESS_PATH } from '../lib/routes';

export function NotFound({ path }: { path: string }) {
  return (
    <div className="notfound">
      <p className="kicker">{L('Dirección desconocida', 'Unknown address')}</p>
      <h1>{L('Esa dirección no existe', 'That address does not exist')}</h1>
      <p className="notfound-text">
        {L('En el juego no hay nada en', 'There is nothing in the game at')} <code>#/{path}</code>
        {L('. Puede que el enlace esté cortado o mal copiado. Desde aquí se llega a todo:', '. The link may be cut short or miscopied. Everything can be reached from here:')}
      </p>
      <ul className="notfound-links">
        {SECTION_IDS.map((s) => (
          <li key={s}>
            <a href={`#/${SECTIONS[s].path}`}>
              <b>{SECTIONS[s].name}</b>
              <span>{SECTIONS[s].title}</span>
            </a>
          </li>
        ))}
        <li>
          <a href={`#/${DAILY_PATH}`}>
            <b>{L('Reto del día', 'Daily challenge')}</b>
            <span>{L('Un país y cinco pruebas', 'One country and five tests')}</span>
          </a>
        </li>
        <li>
          <a href={`#/${PROGRESS_PATH}`}>
            <b>{L('Progreso', 'Progress')}</b>
            <span>{L('Lo que ya te sabes', 'What you already know')}</span>
          </a>
        </li>
      </ul>
      <a className="btn btn-primary" href="#/">
        {L('Ir al inicio', 'Go to the start')}
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </div>
  );
}
