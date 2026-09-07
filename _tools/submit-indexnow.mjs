import { assertIndexIntact, readSitemapParts } from './sitemap-parts.mjs';
import { execFileSync } from 'node:child_process';

const host = 'fudosan.atawi.link';
const key = '4111311e01704ffab18c6859b3aa0c68';
const keyLocation = `https://${host}/${key}.txt`;
const dryRun = process.argv.includes('--dry-run');
const submitAll = process.argv.includes('--all');
// sitemap.xml は索引なので <url> は入っていない。3本の urlset から集める。
assertIndexIntact();
const sitemap = readSitemapParts();
const sitemapUrls = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

if (!sitemapUrls.length) throw new Error('No page URLs were found in the sitemap parts');
if (new Set(sitemapUrls).size !== sitemapUrls.length) throw new Error('Duplicate URLs were found in the sitemap parts');

function changedFiles() {
  const from = process.env.INDEXNOW_FROM_SHA || 'HEAD^';
  const to = process.env.INDEXNOW_TO_SHA || 'HEAD';
  const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', from, to], { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

function publicUrl(path) {
  const normalized = path.replaceAll('\\', '/');
  if (normalized === 'index.html') return `https://${host}/`;
  if (normalized.endsWith('/index.html')) return `https://${host}/${normalized.slice(0, -'index.html'.length)}`;
  if (normalized.endsWith('.html')) return `https://${host}/${normalized}`;
  if (normalized === 'llms.txt') return `https://${host}/llms.txt`;
  return null;
}

const allowed = new Set([...sitemapUrls, `https://${host}/llms.txt`]);
const urlList = submitAll
  ? sitemapUrls
  : [...new Set(changedFiles().map(publicUrl).filter((url) => url && allowed.has(url)))];

if (!urlList.length) {
  console.log('IndexNow skipped: this change contains no public page URL from the sitemap.');
  process.exit(0);
}

if (dryRun) {
  console.log(JSON.stringify({ host, keyLocation, urlList }, null, 2));
  process.exit(0);
}

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
