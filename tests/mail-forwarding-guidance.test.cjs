const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const slug = 'remote-house-mail-forwarding-documents';
const page = JSON.parse(read('jikka-guide/data/complete-pages.json')).pages.find(p => p.slug === slug);
const html = read(`jikka-guide/${slug}/index.html`);
const graph = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(m => { const item = JSON.parse(m[1]); return item['@graph'] || [item]; });

test('mail guidance keeps municipal delivery changes and tax-agent procedures distinct', () => {
  const section = page.sections.find(s => s.heading === '転居届は誰が出せて、いつまで有効か');
  assert.equal(section.table.rows.length, 3);
  const cities = new Map(section.table.rows.map(row => [row[0], row.slice(1).join('')]));
  assert.deepEqual([...cities.keys()], ['磐田市', '袋井市', '森町']);
  assert.match(cities.get('磐田市'), /市外在住/);
  assert.match(cities.get('磐田市'), /納税管理人/);
  assert.match(cities.get('袋井市'), /一時的/);
  assert.match(cities.get('袋井市'), /長期的に本人以外/);
  assert.match(cities.get('森町'), /受領に支障/);
  assert.match(cities.get('森町'), /税務課資産税係/);
  assert.ok(html.includes(`<caption>${section.table.caption}</caption>`));
  for (const row of section.table.rows) for (const cell of row) assert.ok(html.includes(cell), cell);
  assert.ok(section.paragraphs.some(p => p.includes('差出人へ返還')));
  for (const forbidden of ['実家のポストに郵便が戻り始めていた', '郵便物は実家のポストへ戻ります', 'という相談は実際にあります', 'いちばん早く持ち込まれる', '翌年春の通知書が確実に手元へ届き']) {
    assert.ok(!JSON.stringify(page).includes(forbidden), forbidden);
    assert.ok(!html.includes(forbidden), forbidden);
  }
});

test('mail guidance publishes the same FAQ, sources and modification date without changing its URL or publication date', () => {
  const url = `https://fudosan.atawi.link/jikka-guide/${slug}/`;
  const article = graph.find(x => x['@type'] === 'Article');
  const faq = graph.find(x => x['@type'] === 'FAQPage');
  assert.ok(article && faq);
  assert.equal(article.url, url);
  assert.equal(article.datePublished, '2026-08-27T09:00:00+09:00');
  assert.equal(article.dateModified, `${page.modified}T09:00:00+09:00`);
  assert.ok(html.includes(`rel="canonical" href="${url}"`));
  assert.equal(page.title, '遠方の実家の郵便物をどうする？転送前に探したい不動産書類');
  for (const item of page.faqs) {
    const rendered = faq.mainEntity.find(q => q.name === item.question);
    assert.equal(rendered?.acceptedAnswer.text, item.answer);
    assert.ok(html.includes(item.answer));
  }
  for (const host of ['www.city.iwata.shizuoka.jp', 'www.city.fukuroi.shizuoka.jp', 'www.town.morimachi.shizuoka.jp', 'www.post.japanpost.jp']) {
    const source = page.sources.find(s => new URL(s.url).hostname === host && s.accessed === '2026-10-26');
    assert.ok(source, host);
    assert.ok(html.includes(`href="${source.url}"`), source.url);
  }
  const entries = [...read('sitemap-core.xml').matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]).filter(x => x.includes(`<loc>${url}</loc>`));
  assert.equal(entries.length, 1);
  assert.ok(entries[0].includes(`<lastmod>${page.modified}</lastmod>`));
});
