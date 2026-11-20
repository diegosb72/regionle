/**
 * What is shown when a screen breaks: instead of a blank page, what happened in plain words and a way
 * out. Nothing is sent anywhere: the details stay on screen for whoever wants to copy them.
 */
import { Home, RefreshCw, RotateCcw } from 'lucide-react';
import { Component, useState, type ReactNode } from 'react';
import { L } from '../lib/i18n';
import { atEmbed } from '../lib/router';

/** A part of the game that is fetched when it is first needed did not arrive. */
export function isLoadError(error: Error): boolean {
  return /dynamically imported module|importing a module script|module script failed|failed to fetch|load failed|unable to preload|error loading/i.test(`${error.name} ${error.message}`);
}

function details(error: Error): string {
  const stack = (error.stack ?? '').split('\n').slice(0, 8).join('\n');
  const head = `${error.name}: ${error.message}`;
  return [head, stack.startsWith(head) ? stack.slice(head.length).trim() : stack, `${typeof location === 'undefined' ? '' : location.href}`, typeof navigator === 'undefined' ? '' : navigator.userAgent].filter(Boolean).join('\n');
}

export function Crash({ error, onRetry }: { error: Error; onRetry?(): void }) {
  const [copied, setCopied] = useState(false);
  const load = isLoadError(error);
  const text = details(error);
  // In a box of another page there is no start to go to, the page is somebody else's and what is kept may be
  // nothing: the way out is to load the box again.
  const boxed = atEmbed();
  return (
    <div className="crash" role="alert">
      <p className="kicker">{L('Vaya', 'Oops')}</p>
      <h1>{load ? L('Esta parte del juego no ha llegado a cargarse', 'This part of the game did not load') : L('Algo ha fallado', 'Something went wrong')}</h1>
      <p>
        {boxed
          ? load
            ? L('Suele ser la conexión, o que hay una versión nueva del juego. Vuelve a cargarlo y prueba otra vez.', 'It is usually the connection, or a new version of the game. Load it again and have another go.')
            : L('Ha sido un error del juego, no tuyo. Puedes volver a intentarlo o cargarlo de nuevo.', 'It was the game’s mistake, not yours. You can try again or load it again.')
          : load
            ? L('Suele ser la conexión, o que hay una versión nueva del juego. Recarga la página y vuelve a intentarlo.', 'It is usually the connection, or a new version of the game. Reload the page and try again.')
            : L('Ha sido un error del juego, no tuyo. Puedes volver a intentarlo, recargar la página o ir al inicio.', 'It was the game’s mistake, not yours. You can try again, reload the page or go back to the start.')}
        {!boxed && ` ${L('Tu progreso está a salvo: se guarda en este navegador.', 'Your progress is safe: it is kept in this browser.')}`}
      </p>
      <div className="crash-actions">
        {onRetry && !load && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            {L('Reintentar', 'Try again')}
          </button>
        )}
        <button type="button" className={load ? 'btn btn-primary' : 'btn'} onClick={() => window.location.reload()}>
          <RefreshCw size={16} aria-hidden="true" />
          {boxed ? L('Volver a cargar', 'Load again') : L('Recargar la página', 'Reload the page')}
        </button>
        {!boxed && (
          <a
            className="btn btn-ghost"
            href="#/"
            onClick={() => {
              // The address may already be the first page (a crash on it): leaving the error is then all there is to do.
              onRetry?.();
            }}
          >
            <Home size={16} aria-hidden="true" />
            {L('Ir al inicio', 'Go to the start')}
          </a>
        )}
      </div>
      <details className="crash-details">
        <summary>{L('Detalles técnicos', 'Technical details')}</summary>
        <pre>{text}</pre>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(text)
              .then(() => setCopied(true))
              .catch(() => undefined);
          }}
        >
          {copied ? L('Copiado', 'Copied') : L('Copiar', 'Copy')}
        </button>
      </details>
    </div>
  );
}

interface Props {
  children: ReactNode;
  /** What to draw instead of the usual message (the outermost boundary has no styles to count on). */
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

/**
 * Catches what breaks while drawing its children. Give it a `key` that changes with the address and
 * moving to another screen leaves the error behind.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  retry = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.fallback ? this.props.fallback(error, this.retry) : <Crash error={error} onRetry={this.retry} />;
  }
}
