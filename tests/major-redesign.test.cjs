const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const karte = fs.readFileSync(path.join(root, 'karte/index.html'), 'utf8');
const sample = fs.readFileSync(path.join(root, 'karte/sample/index.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'functions/api/karte-apply.js'), 'utf8');
const contextCode = fs.readFileSync(path.join(root, 'assets/karte-context.js'), 'utf8');

test('P0 situation context uses only non-personal identifiers and migrates facility', () => {
  const data = new Map([['fga_karte_situation_v1', 'facility']]);
  const window = { sessionStorage: { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } };
  vm.runInNewContext(contextCode, { window });
  assert.equal(window.karteContext.read(), 'care');
  assert.equal(window.karteContext.save('inheritance'), 'inheritance');
  assert.equal(data.get('fga_karte_situation_v1'), 'inheritance');
  assert.equal(window.karteContext.save('磐田市見付'), '');
  assert.equal(window.karteContext.sampleFor('care'), 'a');
  assert.equal(window.karteContext.sampleFor('inheritance'), 'b');
  window.karteContext.clear();
  assert.equal(window.karteContext.read(), '');
});

test('top implements the requested decision-first copy and keeps direct application', () => {
  assert.match(home, /実家のこと、何から決めればいいか。/);
  assert.match(home, /今の状況から確認する/);
  assert.match(home, /届くカルテの見本を見る/);
  assert.match(home, /class="header-direct"[^>]*>無料で依頼</);
  for (const situation of ['care', 'inheritance', 'vacant', 'undecided', 'unknown']) {
    assert.match(home, new RegExp(`data-situation="${situation}"`));
  }
});

test('sample remains explicitly fictional and preselects without overwriting context', () => {
  assert.match(sample, /架空の物件・金額を使った見本です。/);
  assert.match(sample, /karteContext\.sampleFor\(currentSituation\)/);
  assert.doesNotMatch(sample, /karteContext\.save\(/);
  for (const id of ['a', 'b', 'c']) assert.match(sample, new RegExp(`data-sample="${id}"`));
});

test('both application pages require municipality and town, keep detail optional, and do not put personal data in URLs', () => {
  for (const html of [home, karte]) {
    assert.match(html, /id="city"/);
    assert.match(html, /id="town"/);
    assert.match(html, /id="addressDetail"/);
    assert.match(html, /id="applicantName"/);
    assert.match(html, /id="consultationMessage"[^>]*maxlength="500"/);
    assert.doesNotMatch(html, /location\.href\s*=\s*[^;]*(addr|mail|tel|consultationMessage)/);
  }
});

test('existing endpoint and recipient stay fixed while optional situation reaches notification', () => {
  assert.match(home, /var KARTE_API = '\/api\/karte-apply'/);
  assert.match(karte, /var KARTE_API = '\/api\/karte-apply'/);
  assert.match(api, /const DEFAULT_MAIL_TO = 'fudosan@fujigaoka-service\.co\.jp'/);
  assert.match(api, /\['situation', '現在の状況'\]/);
  assert.match(api, /return json\(\{ ok: true \}\)/);
  assert.match(api, /return json\(\{ ok: false, error: 'send_failed' \}, 502\)/);
});

test('new shared and sample scripts parse', () => {
  new vm.Script(contextCode, { filename: 'assets/karte-context.js' });
  for (const match of sample.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!match[1].includes('src=')) new vm.Script(match[2], { filename: 'karte/sample/index.html' });
  }
});

