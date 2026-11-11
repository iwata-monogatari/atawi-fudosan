const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const policy = JSON.parse(read('data/karte-service-policy.json'));

test('public service promises distinguish initial contact from PDF delivery and do not charge for necessary checks', () => {
  const pages = ['index.html', 'karte/index.html', 'karte/sample/index.html',
    'faq/index.html', 'results/index.html', 'karte/thanks/index.html',
    'karte/results/iwata-house-202510/index.html', 'karte/results/iwata-farmland-202609/index.html'];
  for (const file of pages) {
    const html = read(file);
    assert.match(html, /そろった日の翌々日まで/, file);
    assert.match(html, /(?:メール|LINE)/, file);
    assert.doesNotMatch(html, /追加の現地調査などを希望する場合は、内容と費用|現地調査や専門家業務などを追加で希望/, file);
    assert.doesNotMatch(html, /申込(?:み)?日の翌々日|原則2日以内/, file);
  }
  for (const file of ['index.html', 'karte/index.html']) {
    const html = read(file);
    assert.match(html, /初回連絡は原則2営業日以内/);
    assert.match(html, /初回の連絡方法/);
    const service = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'Service');
    assert.ok(service.description.includes(policy.copy.delivery));
    assert.ok(service.offers.description.includes(policy.copy.necessaryChecks));
  }
});

test('FAQ structured answers reproduce visible delivery, fees and free aftercare explanations', () => {
  const html = read('faq/index.html');
  const schema = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'FAQPage');
  const visible = [...html.matchAll(/<details class="faq-item"><summary>(.*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
    .map(match => [match[1], match[2].replace(/<[^>]+>/g, '')]);
  assert.deepEqual(schema.mainEntity.map(item => [item.name, item.acceptedAnswer.text]), visible);
  assert.ok(visible.some(([,answer]) => answer.includes(policy.copy.delivery)));
  assert.ok(visible.some(([,answer]) => answer.includes(policy.copy.aftercare)));
  assert.equal(policy.companyBilling, 'brokerage_fee_only');
  assert.equal(policy.externalCostBilling, 'customer_pays_provider_directly');
  assert.equal(policy.specialistBilling, 'each_specialist_invoices_customer');
  assert.ok(html.includes(policy.copy.pricing));
  assert.ok(html.includes(policy.copy.externalCosts));
  assert.match(html, /取得実費(?:も|を含めて)無料/);
});

test('company pricing is explicit in visible entry pages and external costs remain separate', () => {
  const files = ['index.html', 'karte/index.html', 'faq/index.html', 'karte/sample/index.html',
    'karte/thanks/index.html', 'results/index.html', 'karte/line/index.html',
    'karte/results/iwata-house-202510/index.html', 'karte/results/iwata-farmland-202609/index.html'];
  const lps = JSON.parse(read('lp/content.json')).map(page => `lp/${page.slug}/index.html`);
  for (const file of [...files, ...lps]) {
    const html = read(file);
    const visible = html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
    assert.ok(visible.includes(policy.copy.pricing), `${file}: visible company billing`);
    assert.ok(visible.includes(policy.copy.externalCosts), `${file}: direct external payments`);
    assert.doesNotMatch(html, /標準分|標準的な資料取得|実作業や追加調査は別途|専門家の手続きは別料金/, file);
    if (file.startsWith('lp/')) {
      const schema = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .map(m => JSON.parse(m[1])).find(x => x['@graph']);
      const faq = schema['@graph'].find(x => x['@type'] === 'FAQPage');
      const answers = [...html.matchAll(/<details><summary>(.*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
        .map(m => [m[1], m[2]]);
      assert.deepEqual(faq.mainEntity.map(x => [x.name, x.acceptedAnswer.text]), answers, file);
      const service = schema['@graph'].find(x => x['@type'] === 'Service');
      assert.equal(service.offers.price, '0');
      assert.match(service.offers.description, /無料の実家カルテ作成・相談サービス/);
      assert.ok(service.offers.description.includes(policy.copy.pricing));
    }
  }
});

test('no separately billed company field report remains in guides or flyer source', () => {
  for (const name of fs.readdirSync(path.join(root, 'karte/guide'))) {
    const file = `karte/guide/${name}/index.html`;
    if (!fs.existsSync(path.join(root, file))) continue;
    assert.doesNotMatch(read(file), /現地確認レポート.{0,20}(?:33,000|33000|３３，０００)/, file);
  }
  assert.doesNotMatch(read('tools/flyer/make_flyer.py'), /33,000|月額5,500/);
  assert.ok(policy.free.includes('necessary_documents_and_acquisition_costs'));
  assert.ok(policy.copy.freeServices.includes('取得実費も当社が負担'));
  assert.match(policy.copy.noSaleCondition, /仲介契約や売却をお願いすることはありません/);
});

test('pricing regeneration is repeatable and preserves unrelated guide content', async () => {
  const { refreshKartePricing } = await import('../_tools/karte-service-policy.mjs');
  const prefix = '<p>既存本文・番地・地番と返信先</p>';
  const suffix = '<a href="/karte/">既存リンク</a>';
  const original = prefix + '<p class="guide-cta__eyebrow">標準分0円｜売却営業なし</p>' + suffix;
  const refreshed = refreshKartePricing(original);
  assert.equal(refreshed, prefix + '<p class="guide-cta__eyebrow">' + policy.copy.shortPricing + '</p>' + suffix);
  assert.equal(refreshKartePricing(refreshed), refreshed);
  const { execFileSync } = require('node:child_process');
  const files = ['index.html', 'karte/index.html', 'faq/index.html',
    ...JSON.parse(read('lp/content.json')).map(p => `lp/${p.slug}/index.html`)];
  const before = files.map(f => read(f).replace(/\r\n/g, '\n'));
  execFileSync(process.execPath, ['tools/sync-karte-service-policy.mjs'], {cwd: root});
  execFileSync(process.execPath, ['tools/generate-consultation-lps.mjs'], {cwd: root});
  assert.deepEqual(files.map(f => read(f).replace(/\r\n/g, '\n')), before);
});
