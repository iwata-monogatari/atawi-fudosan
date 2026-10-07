const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const origin = 'https://fudosan.atawi.link';
// These flat HTML files are served at extensionless URLs by Cloudflare Pages.
// Keep the files (and the hosting platform's legacy redirects) in place.
const slugs = [
  'after-care-facility', 'demolition-or-old-house', 'faraway-management',
  'garden-leak-neighbor', 'guilt-of-selling', 'leftover-items',
  'sell-with-belongings', 'where-to-start',
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('jikka article metadata identifies the extensionless response URL', () => {
  for (const slug of slugs) {
    const html = read(`jikka/articles/${slug}.html`);
    const url = `${origin}/jikka/articles/${slug}`;
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), slug);
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`), slug);
    assert.doesNotMatch(html, /<meta\b[^>]*noindex/i);
    const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .map(match => JSON.parse(match[1]));
    const breadcrumb = schemas.find(schema => schema['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumb.itemListElement.at(-1).item, url, slug);
  }
});

test('both published sitemaps list each canonical jikka article exactly once', () => {
  for (const file of ['sitemap-core.xml', 'jikka/sitemap.xml']) {
    const xml = read(file);
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    for (const slug of slugs) {
      const url = `${origin}/jikka/articles/${slug}`;
      assert.equal(urls.filter(value => value === url).length, 1, `${file}: ${slug}`);
      assert.ok(!urls.includes(`${url}.html`), `${file}: legacy URL ${slug}`);
    }
  }
});

test('published HTML and scripts do not send article readers through legacy redirects', () => {
  const oldUrl = new RegExp(`(?:${slugs.join('|')})\\.html(?:["'#?\\s<]|$)`);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'tests', 'docs', '_tools', 'tools', 'blog-auto'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:html|js|json|xml|txt)$/.test(entry.name)) {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), oldUrl, path.relative(root, file));
      }
    }
  }
  walk(root);
});
