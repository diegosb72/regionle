import { expect, test } from '@playwright/test';
import { OPTS, PIN_SPAIN, seed } from './helpers';

/**
 * The card of Wikipedia shown after a miss, with Wikidata and Wikipedia played by the test: which article is
 * asked for is what is looked at here, not what those sites answer.
 */
test.describe('the card of Wikipedia', () => {
  test('finds a piece without a Wikidata id by its ISO code, not by a search of its name', async ({ page }) => {
    const asked: string[] = [];
    const json = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    await page.route(/^https:\/\/www\.wikidata\.org\//, (route) => {
      const url = new URL(route.request().url());
      asked.push(`wikidata ${url.search}`);
      const search = url.searchParams.get('srsearch');
      if (search) {
        // "haswbstatement:P300=ES-CN" → the item that carries that code.
        const code = /^haswbstatement:P300=([A-Z]{2}-[A-Z0-9]+)$/.exec(search)?.[1];
        return route.fulfill(json({ query: { search: code ? [{ ns: 0, title: `Q${[...code].reduce((n, ch) => n * 37 + ch.charCodeAt(0), 0)}` }] : [] } }));
      }
      const id = url.searchParams.get('ids') ?? '';
      return route.fulfill(json({ entities: { [id]: { sitelinks: { eswiki: { title: `Artículo ${id}` } } } } }));
    });
    await page.route(/^https:\/\/(es|en)\.wikipedia\.org\//, (route) => {
      const url = new URL(route.request().url());
      asked.push(`wikipedia ${url.pathname}${url.search}`);
      // A search by name: what the card must no longer need for these pieces.
      if (url.pathname === '/w/api.php') return route.fulfill(json({ query: { search: [{ title: 'Gobierno de Canarias' }] } }));
      const title = decodeURIComponent(url.pathname.split('/').pop() ?? '').replace(/_/g, ' ');
      return route.fulfill(json({ type: 'standard', title, extract: `Lo que dice Wikipedia de ${title}.`, content_urls: { desktop: { page: `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}` } } }));
    });

    // The autonomous communities of Spain are groupings made by the game: none carries a Wikidata id.
    await seed(page, { game: { ...PIN_SPAIN, opts: { ...OPTS, wiki: true } } });
    await page.goto('./#/jugar');
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'No lo sé' }).click();

    const card = page.locator('.wiki');
    await expect(card.locator('p')).toHaveText(/^Lo que dice Wikipedia de Artículo Q\d+\.$/);
    await expect(card.locator('p')).toHaveAttribute('lang', 'es');
    await expect(card.getByRole('link', { name: /Seguir leyendo en Wikipedia/ })).toHaveAttribute('href', /^https:\/\/es\.wikipedia\.org\/wiki\//);

    // Asked: which item has the code, which articles it has, and the article. Nothing was searched by name.
    expect(asked).toHaveLength(3);
    expect(decodeURIComponent(asked[0])).toMatch(/srsearch=haswbstatement:P300=ES-[A-Z]{2}&/);
    expect(asked[0]).toContain('origin=*');
    expect(asked[1]).toMatch(/action=wbgetentities&ids=Q\d+/);
    expect(asked[2]).toMatch(/^wikipedia \/api\/rest_v1\/page\/summary\/Art/);
  });
});
