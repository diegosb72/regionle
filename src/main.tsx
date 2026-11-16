import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/dm-sans/wght.css';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { L, browserLang, getLang, setLang } from './lib/i18n';
import { registerOffline } from './lib/offline';
import { useStore } from './lib/store';
import './styles.css';

/**
 * The language is module state read by every text when it is drawn: it is set before anything renders,
 * and the whole interface is mounted again when the player changes it.
 */
function Root() {
  const lang = useStore((s) => s.lang) ?? browserLang();
  if (getLang() !== lang) setLang(lang);
  useEffect(() => {
    document.title = L('Regionle ∞ — Aprende las regiones del mundo', 'Regionle ∞ — Learn the regions of the world');
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      L(
        'Regionle ∞: juego de geografía sin límites para aprender los países del mundo y sus regiones, capitales, banderas, ciudades, ríos, mares y montañas.',
        'Regionle ∞: a geography game with no limits to learn the countries of the world and their regions, capitals, flags, cities, rivers, seas and mountains.',
      ),
    );
  }, [lang]);
  return <App key={lang} />;
}

setLang(useStore.getState().lang ?? browserLang());
registerOffline();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
