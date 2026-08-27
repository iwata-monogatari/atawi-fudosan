import { assertIndexIntact, readSitemapParts } from './sitemap-parts.mjs';

const host = 'fudosan.atawi.link';
const key = '4111311e01704ffab18c6859b3aa0c68';
const keyLocation = `https://${host}/${key}.txt`;
// sitemap.xml は索引なので <url> は入っていない。3本の urlset から集める。
assertIndexIntact();
const sitemap = readSitemapParts();
const urlList = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

if (!urlList.length) throw new Error('No page URLs were found in the sitemap parts');
if (new Set(urlList).size !== urlList.length) throw new Error('Duplicate URLs were found in the sitemap parts');

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`IndexNow returned HTTP ${response.status}: ${body}`);
}

console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${response.status}).`);
