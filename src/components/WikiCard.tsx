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

interface Article {
  title: string;
  lang: Lang;
}

/**
 * The articles about an item, the one in the language of the interface first. With a Wikidata id they are
 * the ones linked to it, in either language; without one, whatever a search by name finds in the
 * language of the interface (the names are only known in that one, so the other is not searched).
 */
async function articlesOf(item: Item, lang: Lang): Promise<Article[]> {
  const other: Lang = lang === 'es' ? 'en' : 'es';
  if (item.wd) {
    const data = (await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${item.wd}&props=sitelinks&sitefilter=${lang}wiki%7C${other}wiki&format=json&origin=*`)) as {
      entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
    };
    const links = data.entities?.[item.wd]?.sitelinks ?? {};
    return [lang, other].flatMap((l) => {
      const title = links[`${l}wiki`]?.title;
      return title ? [{ title, lang: l }] : [];
    });
  }
  const data = (await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(placeQuery(item))}&srlimit=1&srnamespace=0&format=json&origin=*`)) as {
    query?: { search?: { title?: string }[] };
  };
  const title = data.query?.search?.[0]?.title;
  return title ? [{ title, lang }] : [];
}

/** Two or three sentences are enough next to a question. */
export function shorten(extract: string): string {
  // Cut after the mark that ends a sentence, without a look-behind: Safari before 16.4 does not read one,
  // and a script it cannot read does not run at all.
  const sentences = extract.replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«(])/g, '$1\u0000').split('\u0000');
  let text = '';
  for (const part of sentences) {
    if (text && (text.length + part.length > 420 || text.length > 260)) break;
    text += (text ? ' ' : '') + part;
  }
  return text.length > 520 ? `${text.slice(0, 500).replace(/\s+\S*$/, '')}…` : text;
}

/** What an article says at its start; null when it says nothing that can be shown (no text, or a list of meanings). */
async function summaryOf(article: Article): Promise<Summary | null> {
  const s = (await getJson(`https://${article.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title.replace(/ /g, '_'))}`)) as {
    type?: string;
    title?: string;
    extract?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
  if (!s.extract || s.type === 'disambiguation') return null;
  return {
    title: s.title ?? article.title,
    text: shorten(s.extract),
    image: s.thumbnail?.source,
    url: s.content_urls?.desktop?.page ?? `https://${article.lang}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
    lang: article.lang,
  };
}

/** The first article that has something to show: the one in the player's language, and the other one only when that one fails. */
async function load(item: Item, lang: Lang): Promise<Summary | null> {
  for (const article of await articlesOf(item, lang)) {
    const summary = await summaryOf(article).catch(() => null);
    if (summary) return summary;
  }
  return null;
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
