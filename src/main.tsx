import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/dm-sans/wght.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
