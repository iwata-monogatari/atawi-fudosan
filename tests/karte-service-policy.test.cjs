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
  assert.match(html, /各専門家がお客様へ請求/);
  assert.match(html, /取得実費(?:も|を含めて)無料/);
});
