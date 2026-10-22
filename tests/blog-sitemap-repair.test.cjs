const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.join(__dirname, '..');
const modulePromise = import('../_tools/repair-blog-sitemap-20261023.mjs');

test('scoped sitemap repair removes only verified entries and preserves all other bytes and dates', async t => {
  const { missingSlugs, repairBlogSitemap } = await modulePromise;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fudo-sitemap-repair-'));
  t.after(() => fs.rmSync(temp, {recursive:true, force:true}));
  const retained = '<urlset>\n  <url><loc>https://fudosan.atawi.link/blog/keep/</loc><lastmod>2026-09-01</lastmod></url>\n</urlset>\n';
  const entries = missingSlugs.map(s => `  <url><loc>https://fudosan.atawi.link/blog/${s}/</loc><lastmod>2026-10-10</lastmod></url>\n`).join('');
  const source = retained.replace('</urlset>', entries + '</urlset>');
  assert.equal(repairBlogSitemap(source,temp), retained);
  assert.equal(repairBlogSitemap(retained,temp), retained);
  assert.throws(() => repairBlogSitemap(source.replace('2026-10-10','2026-10-11'),temp), /Registration changed/);
  assert.throws(() => repairBlogSitemap(source.replace('</urlset>',entries+'</urlset>'),temp), /Duplicate/);
  const restored = path.join(temp,'blog',missingSlugs[3]);
  fs.mkdirSync(restored,{recursive:true});fs.writeFileSync(path.join(restored,'index.html'),'restored');
  assert.throws(() => repairBlogSitemap(source,temp), /Article now exists/);
});

test('published blog sitemap contains an existing article for every dated blog URL', () => {
  const xml = fs.readFileSync(path.join(root,'sitemap-blog.xml'),'utf8');
  let checked = 0;
  for (const match of xml.matchAll(/<loc>https:\/\/fudosan\.atawi\.link\/(blog\/\d{8}-[^<]+\/)\<\/loc>/g)) {
    checked++;
    assert.ok(fs.existsSync(path.join(root,match[1],'index.html')), `No source for ${match[1]}`);
  }
  assert.ok(checked > 100, `Expected complete article inventory, checked ${checked}`);
});
