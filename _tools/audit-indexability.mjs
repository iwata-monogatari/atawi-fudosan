import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://fudosan.atawi.link';
const sitemapSource = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemapSource.matchAll(/<loc>(https:\/\/fudosan\.atawi\.link[^<]+)<\/loc>/g)]
  .map((match) => match[1])
  .filter((url) => !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(new URL(url).pathname));
const sitemapSet = new Set(sitemapUrls);

function htmlPath(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  if (pathname === '/') return path.join(root, 'index.html');
  const relative = pathname.replace(/^\/+/, '');
  return path.join(root, pathname.endsWith('/') ? relative + 'index.html' : relative);
}

function canonicalUrl(source) {
  const tag = source.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? null;
}

function normalizedInternalUrl(href, pageUrl) {
  if (!href || /^(?:mailto:|tel:|javascript:|data:|#)/i.test(href)) return null;
  let url;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  url.hash = '';
  url.search = '';
  return url.href;
}

const incoming = new Map(sitemapUrls.map((url) => [url, new Set()]));
const outgoing = new Map();
const errors = [];

for (const url of sitemapUrls) {
  const file = htmlPath(url);
  if (!fs.existsSync(file)) {
    errors.push(`${url}: sitemap URL has no matching file (${path.relative(root, file)})`);
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  const canonical = canonicalUrl(source);
  if (canonical !== url) errors.push(`${url}: canonical is ${canonical ?? 'missing'}`);
  if (/<meta\b[^>]*\bcontent=["'][^"']*noindex/i.test(source)) {
    errors.push(`${url}: page has noindex`);
  }
  const links = new Set();
  for (const match of source.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const linkedUrl = normalizedInternalUrl(match[1], url);
    if (!linkedUrl || !sitemapSet.has(linkedUrl) || linkedUrl === url) continue;
    links.add(linkedUrl);
    incoming.get(linkedUrl).add(url);
  }
  outgoing.set(url, links);
}

const reachable = new Set([`${origin}/`]);
const queue = [...reachable];
while (queue.length) {
  const current = queue.shift();
  for (const linked of outgoing.get(current) ?? []) {
    if (reachable.has(linked)) continue;
    reachable.add(linked);
    queue.push(linked);
  }
}

const orphanUrls = sitemapUrls.filter((url) => incoming.get(url).size === 0 && url !== `${origin}/`);
const unreachableUrls = sitemapUrls.filter((url) => !reachable.has(url));
const weakUrls = sitemapUrls
  .filter((url) => url !== `${origin}/` && incoming.get(url).size <= 1)
  .sort((a, b) => incoming.get(a).size - incoming.get(b).size || a.localeCompare(b));

console.log(JSON.stringify({
  sitemapUrls: sitemapUrls.length,
  errors,
  orphanUrls,
  unreachableUrls,
  weakUrls: weakUrls.map((url) => ({ url, incomingLinks: incoming.get(url).size })),
  counts: {
    errors: errors.length,
    orphanUrls: orphanUrls.length,
    unreachableUrls: unreachableUrls.length,
    weakUrls: weakUrls.length,
  },
}, null, 2));

if (errors.length || orphanUrls.length || unreachableUrls.length) process.exitCode = 1;
