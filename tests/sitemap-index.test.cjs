const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const parts = ['sitemap-core.xml', 'sitemap-cases.xml', 'sitemap-blog.xml'];

test('sitemap index preserves all three parts without unsynchronised lastmod hints', () => {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  assert.match(xml, /<sitemapindex\b/);
  assert.doesNotMatch(xml, /<url(?:\s|>)/);
  assert.doesNotMatch(xml, /<lastmod(?:\s|>)/);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]),
    parts.map(name => `https://fudosan.atawi.link/${name}`));
  for (const name of parts) {
    assert.match(fs.readFileSync(path.join(root, name), 'utf8'), /<urlset\b/);
  }
});

test('consultation regeneration preserves the index and every existing child sitemap byte', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fudosan-sitemap-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const files = ['sitemap.xml', ...parts, 'lp/content.json', 'lp/updates.json',
    'tools/generate-consultation-lps.mjs'];
  for (const file of files) {
    const output = path.join(temp, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(root, file), output);
  }
  execFileSync(process.execPath, [path.join(temp, 'tools/generate-consultation-lps.mjs')],
    { cwd: temp, stdio: 'pipe' });
  for (const name of ['sitemap.xml', ...parts]) {
    assert.deepEqual(fs.readFileSync(path.join(temp, name)), fs.readFileSync(path.join(root, name)),
      `${name} changed during regeneration; inspect URL-level lastmod before publishing`);
  }
});

test('public site update history records the sitemap index correction without changing article dates', () => {
  const html = fs.readFileSync(path.join(root, 'updates/index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/fudosan\.atawi\.link\/updates\/">/);
  assert.doesNotMatch(html, /noindex/i);
  assert.match(html, /<time datetime="2026-10-06">2026年10月6日<\/time>/);
  assert.match(html, /サイトマップ索引の更新日時表記を整理/);
  assert.match(html, /記事ごとの更新日は変更していません/);
  assert.match(html, /href="\/sitemap\.xml"/);
  assert.match(html, /href="\/lp\/updates\/"/);

  const sitemap = fs.readFileSync(path.join(root, 'sitemap-core.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>https:\/\/fudosan\.atawi\.link\/updates\/<\/loc>/g) || []).length, 1);
  const lpHistory = fs.readFileSync(path.join(root, 'lp/updates/index.html'), 'utf8');
  assert.match(lpHistory, /href="\/updates\/"[^>]*>サイト全体の更新履歴を見る<\/a>/);
});
