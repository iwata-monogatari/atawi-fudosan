import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = 'fudosan.atawi.link';
const key = '4111311e01704ffab18c6859b3aa0c68';
const keyLocation = `https://${host}/${key}.txt`;
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

if (!urlList.length) throw new Error('No page URLs were found in sitemap.xml');
if (new Set(urlList).size !== urlList.length) throw new Error('Duplicate URLs were found in sitemap.xml');

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
