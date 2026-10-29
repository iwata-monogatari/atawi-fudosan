const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');

test('sitemap pages have existing local image and logo references in JSON-LD', () => {
  const errors = [];
  const xml = ['sitemap-core.xml', 'sitemap-blog.xml', 'sitemap-cases.xml'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('');
  const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  for (const url of urls) {
    const pathname = decodeURIComponent(new URL(url).pathname);
    let file = path.join(root, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
    if (!fs.existsSync(file)) file += '.html';
    const html = fs.readFileSync(file, 'utf8');
    const walk = value => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!value || typeof value !== 'object') return;
      for (const [key, item] of Object.entries(value)) {
        if (['image', 'logo', 'thumbnailUrl', 'contentUrl'].includes(key) && typeof item === 'string') {
          const asset = new URL(item, url);
          if (asset.origin === 'https://fudosan.atawi.link' && !fs.existsSync(path.join(root, decodeURIComponent(asset.pathname)))) errors.push(`${url}: ${key} ${item}`);
        }
        walk(item);
      }
    };
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) walk(JSON.parse(match[1]));
  }
  assert.deepEqual(errors, []);
});

test('guide service-label sync retains body, company schema and tracking and rejects drift', async () => {
  const { refreshServiceLabel } = await import(pathToFileURL(path.join(root, '_tools/build-jikka-guide.mjs')).href);
  const page = { slug: 'multiple-properties-inheritance-notice', ctaLabel: '筆数を伝えて無料のカルテを依頼する', modified: '2026-10-29' };
  const prefix = '<script type="application/ld+json">{"@type":"Organization"}</script><p>本文を保持</p>';
  const suffix = '<script src="/assets/ai-referral.js"></script>';
  const before = prefix + '<a href="/karte/">筆数を伝えて追加実費確認後にカルテを依頼する</a>' + suffix;
  const after = refreshServiceLabel(before, page);
  assert.ok(after.startsWith(prefix));
  assert.ok(after.endsWith(suffix));
  assert.equal(refreshServiceLabel(after, page), after);
  assert.throws(() => refreshServiceLabel(before.replace('追加実費確認後', '未承認の変更後'), page));
  assert.equal(refreshServiceLabel(before, { ...page, slug: 'different-page' }), before);
});

test('published service copy follows the free necessary-document policy', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'data/karte-service-policy.json'), 'utf8'));
  assert.ok(policy.free.includes('necessary_documents_and_acquisition_costs'));
  const errors = [];
  const obsolete = /実費1,000円前後のみ|資料取得実費1,000円前後|取得実費（1,000円前後）|・実費のみ|価格は出ません（査定ではありません）|筆数を伝えて追加実費確認後/;
  const scan = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith('.html')) {
        const visible = fs.readFileSync(file, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '');
        if (obsolete.test(visible)) errors.push(path.relative(root, file));
      }
    }
  };
  for (const dir of ['blog', 'karte', 'jikka-guide', 'jikka', 'guide']) scan(path.join(root, dir));
  assert.deepEqual(errors, []);
});
