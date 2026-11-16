import { useEffect, useState } from 'react';

function current(): string {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0];
}

/** Hash routing: works from any folder and needs no server configuration. */
export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => setRoute(current());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = `#/${path}`;
  window.scrollTo(0, 0);
}
