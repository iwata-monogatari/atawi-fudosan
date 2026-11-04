const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
test('診断結果から物件の個別相談に進む前に、所在地・返信先と地番の確認方法を案内する', () => {
  const engine = fs.readFileSync(path.join(root, 'shindan/assets/diag.js'), 'utf8');
  const start = engine.indexOf('cta.innerHTML');
  const actions = engine.indexOf('diag_cta_karte', start);
  assert.ok(start >= 0 && actions > start);
  const guidance = engine.slice(start, actions);
  for (const term of ['番地・地番', '返信先', '課税明細書']) assert.ok(guidance.includes(term), term);
});

test('住所だけで申込みが完了する文言を拒み、匿名診断・地図検索の案内を許容する', async () => {
  const { addressPolicyErrors } = await import('../_tools/check-property-address-policy.mjs');
  for (const claim of ['住所を送るだけで、宅建士が調査します。', 'ご入力は住所を送るだけ・1分です。']) {
    assert.ok(addressPolicyErrors(claim).length > 0, claim);
  }
  assert.deepEqual(addressPolicyErrors('診断は住所不要です。地図は住所を入力するだけで検索できます。'), []);
});
