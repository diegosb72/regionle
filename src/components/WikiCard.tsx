/**
 * What Wikipedia says about a place, in two or three sentences and a picture. It is fetched from the
 * player's browser when it is needed and kept for the session; with no connection, or if Wikipedia does
 * not answer, the card simply does not appear and the links underneath remain.
 */
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { L, getLang, type Lang } from '../lib/i18n';
import { placeQuery } from '../lib/links';
import type { Item } from '../lib/types';

interface Summary {
  title: string;
  text: string;
  image?: string;
  url: string;
  lang: Lang;
}

const cache = new Map<string, Promise<Summary | null>>();
const TIMEOUT = 7000;

async function getJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Title of the article and the language it is in: by its Wikidata id when the data has one, by search otherwise. */
async function articleOf(item: Item, lang: Lang): Promise<{ title: string; lang: Lang } | null> {
  const other: Lang = lang === 'es' ? 'en' : 'es';
  if (item.wd) {
    const data = (await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${item.wd}&props=sitelinks&sitefilter=${lang}wiki%7C${other}wiki&format=json&origin=*`)) as {
      entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
    };
    const links = data.entities?.[item.wd]?.sitelinks ?? {};
    for (const l of [lang, other]) {
      const title = links[`${l}wiki`]?.title;
      if (title) return { title, lang: l };
    }
    return null;
  }
  const data = (await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(placeQuery(item))}&srlimit=1&srnamespace=0&format=json&origin=*`)) as {
    query?: { search?: { title?: string }[] };
  };
  const title = data.query?.search?.[0]?.title;
  return title ? { title, lang } : null;
}

async function load(item: Item, lang: Lang): Promise<Summary | null> {
  const article = await articleOf(item, lang);
  if (!article) return null;
  const s = (await getJson(`https://${article.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title.replace(/ /g, '_'))}`)) as {
    type?: string;
    title?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
  if (!s.extract || s.type === 'disambiguation') return null;
  // Two or three sentences are enough next to a question.
  const sentences = s.extract.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«(])/);
  let text = '';
  for (const part of sentences) {
    if (text && (text.length + part.length > 420 || text.length > 260)) break;
    text += (text ? ' ' : '') + part;
  }
  return {
    title: s.title ?? article.title,
    text: text.length > 520 ? `${text.slice(0, 500).replace(/\s+\S*$/, '')}…` : text,
    image: s.thumbnail?.source,
    url: s.content_urls?.desktop?.page ?? `https://${article.lang}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
    lang: article.lang,
  };
}

export function wikiSummary(item: Item): Promise<Summary | null> {
  const lang = getLang();
  const key = `${lang}:${item.id}`;
  let p = cache.get(key);
  if (!p) {
    p = load(item, lang).catch(() => null);
    cache.set(key, p);
  }
  return p;
}

export function WikiCard({ item }: { item: Item }) {
  const [state, setState] = useState<{ id: string; data: Summary | null | undefined }>({ id: item.id, data: undefined });
  useEffect(() => {
    let alive = true;
    setState({ id: item.id, data: undefined });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState({ id: item.id, data: null });
      return;
    }
    wikiSummary(item).then((data) => alive && setState({ id: item.id, data }));
    return () => {
      alive = false;
    };
  }, [item]);

  const data = state.id === item.id ? state.data : undefined;
  if (data === null) return null;
  if (data === undefined) {
    return (
      <div className="wiki wiki-loading" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );
  }
  return (
    <div className="wiki">
      {data.image && <img src={data.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
      <p lang={data.lang}>{data.text}</p>
      <a href={data.url} target="_blank" rel="noopener noreferrer">
        {L('Seguir leyendo en Wikipedia', 'Read more on Wikipedia')}
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
