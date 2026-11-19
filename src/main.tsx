import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/dm-sans/wght.css';
// The typeface for dyslexia: its files are only fetched by whoever turns it on (src/lib/reading.ts).
import '@fontsource-variable/lexend/wght.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { browserLang, getLang, setLang, type Lang } from './lib/i18n';
import { registerOffline } from './lib/offline';
import { followLang } from './lib/router';
import { pageLang } from './lib/routes';
import { useStore } from './lib/store';
import './styles.css';

/**
 * The language of this visit: the one the player has chosen; failing that, the one of the page
 * (`en.html` and `regions.html` are the game in English; `es.html` and `regiones.html`, in Spanish);
 * failing that, the browser's.
 */
const langFor = (chosen: Lang | null): Lang => chosen ?? pageLang(window.location.pathname) ?? browserLang();

/**
 * The language is module state read by every text when it is drawn: it is set before anything renders,
 * and the whole interface is mounted again when the player changes it.
 */
function Root() {
  const lang = langFor(useStore((s) => s.lang));
  if (getLang() !== lang) setLang(lang);
  return <App key={lang} />;
}

setLang(langFor(useStore.getState().lang));
// Whoever chose Spanish and opens `regions.html` gets the regions in Spanish, at `regiones.html`.
followLang(getLang());
registerOffline();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
