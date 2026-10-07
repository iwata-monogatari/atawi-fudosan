const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const origin = 'https://fudosan.atawi.link';
const helpers = import('../_tools/indexnow-urls.mjs');
const canonical = url => `<link rel="canonical" href="${url}">`;

test('IndexNow keeps flat HTML, directory index, root and llms fallback behavior', async () => {
  const { publicUrlForFile } = await helpers;
  for (const [file, url] of [
    ['index.html', '/'], ['blog/post/index.html', '/blog/post/'],
    ['jikka/articles/example.html', '/jikka/articles/example.html'],
    ['llms.txt', '/llms.txt'], ['blog\\post\\index.html', '/blog/post/'],
  ]) assert.equal(publicUrlForFile(file, '', origin), origin + url);
  assert.equal(publicUrlForFile('sitemap-core.xml', '', origin), null);
  assert.equal(publicUrlForFile('assets/app.js', '', origin), null);
});

test('IndexNow honors same-origin extensionless canonical and normal index canonical', async () => {
  const { publicUrlForFile } = await helpers;
  assert.equal(publicUrlForFile('jikka/articles/example.html', canonical(`${origin}/jikka/articles/example`), origin), `${origin}/jikka/articles/example`);
  assert.equal(publicUrlForFile('blog/post/index.html', canonical(`${origin}/blog/post/`), origin), `${origin}/blog/post/`);
  assert.equal(publicUrlForFile('jikka/articles/example.html', canonical('/jikka/articles/example'), origin), `${origin}/jikka/articles/example`);
});

test('IndexNow rejects external, malformed and non-plain canonicals with the original fallback', async () => {
  const { publicUrlForFile } = await helpers;
  for (const url of [
    'https://example.com/page', '//example.com/page', 'javascript:alert(1)',
    'http://[invalid', `https://user:pass@fudosan.atawi.link/page`,
    `${origin}/page?tracking=1`, `${origin}/page#section`,
  ]) assert.equal(publicUrlForFile('old.html', canonical(url), origin), `${origin}/old.html`, url);
});

test('IndexNow retains sitemap allowlisting and URL deduplication after canonical mapping', async () => {
  const { changedPublicUrls } = await helpers;
  const pages = {
    'one.html': canonical(`${origin}/one`),
    'duplicate.html': canonical(`${origin}/one`),
    'unlisted.html': canonical(`${origin}/not-in-sitemap`),
    'external.html': canonical('https://example.com/one'),
  };
  assert.deepEqual(changedPublicUrls([...Object.keys(pages), 'llms.txt', 'sitemap-core.xml'], [`${origin}/one`], {
    origin, readHtml: file => pages[file],
  }), [`${origin}/one`, `${origin}/llms.txt`]);
});

test('IndexNow includes all eight current extensionless jikka article URLs', async () => {
  const { changedPublicUrls } = await helpers;
  const root = path.join(__dirname, '..');
  const files = fs.readdirSync(path.join(root, 'jikka/articles'))
    .filter(file => file.endsWith('.html') && file !== 'index.html')
    .map(file => `jikka/articles/${file}`);
  const sitemap = fs.readFileSync(path.join(root, 'sitemap-core.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const actual = changedPublicUrls(files, urls, {
    origin, readHtml: file => fs.readFileSync(path.join(root, file), 'utf8'),
  });
  assert.equal(actual.length, 8);
  assert.deepEqual(actual.sort(), files.map(file => `${origin}/${file.slice(0, -5)}`).sort());
});
