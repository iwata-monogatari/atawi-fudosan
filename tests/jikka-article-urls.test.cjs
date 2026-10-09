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

test('where-to-start offers ordinary contextual links to the three existing guides', () => {
  const html = read('jikka/articles/where-to-start.html');
  const body = html.match(/<article\b[^>]*class="section article-body"[^>]*>([\s\S]*?)<\/article>/)[1];
  for (const [slug, label, section] of [
    ['parent-house-document-box', '残す原本・コピー・写真を分ける方法', '相談前に集めるとよい材料'],
    ['family-meeting-agenda-parent-house', '家族会議で確認する議題と順番', '家族へ共有するときの考え方'],
    ['empty-house-first-month-checklist', '空き家になった最初の1か月の確認表', '相談前に集めるとよい材料'],
  ]) {
    const href = `/jikka-guide/${slug}/`;
    const links = [...body.matchAll(/<p>([^<]+)<a href="([^"]+)">([^<]+)<\/a><\/p>/g)]
      .filter(match => match[2] === href);
    assert.equal(links.length, 1, `${slug}: one contextual, JavaScript-independent link`);
    assert.equal(links[0][3], label);
    assert.ok(links[0][1].trim().endsWith('。'), `${slug}: explanation before link`);
    const before = body.slice(0, links[0].index);
    assert.equal([...before.matchAll(/<h2>([^<]+)<\/h2>/g)].at(-1)[1], section);
    const target = read(`jikka-guide/${slug}/index.html`);
    assert.ok(target.includes(`rel="canonical" href="${origin}${href}"`));
  }
  const intro = body.match(/<aside\b[^>]*aria-label="はじめに確認する順番"[^>]*>([\s\S]*?)<\/aside>/)[1].replace(/<[^>]+>/g, '');
  assert.ok([...intro].length <= 200, 'opening summary stays within 200 characters');
});

test('where-to-start preserves publication date and synchronizes its actual revision date', () => {
  const html = read('jikka/articles/where-to-start.html');
  const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const article = schemas.find(s => s['@type'] === 'Article');
  assert.equal(article.datePublished, '2026-07-08');
  assert.match(article.dateModified, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(html.includes(`<time datetime="${article.dateModified}">`));
  for (const file of ['sitemap-core.xml', 'jikka/sitemap.xml']) {
    const entry = [...read(file).matchAll(/<url>([\s\S]*?)<\/url>/g)].find(m => m[1].includes(`<loc>${origin}/jikka/articles/where-to-start</loc>`));
    assert.equal(entry[1].match(/<lastmod>([^<]+)<\/lastmod>/)[1], article.dateModified, file);
  }
});

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
