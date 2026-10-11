const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const corePromise = import('../assets/jikka-memo-core.mjs');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function setAmount(memo, plan, cost, amount, tax = 'included') { memo.plans[plan].costs[cost] = { status: 'amount', amount, tax, includedIn: null }; }

test('blank memo is valid and unknown costs never become zero', async () => {
  const c = await corePromise, memo = c.createMemo();
  assert.equal(c.validateMemo(memo).ok, true);
  for (const plan of c.summarizeMemo(memo).plans) { assert.equal(plan.subtotal, null); assert.equal(plan.subtotalText, '未集計'); assert.equal(plan.unknownCount, 5); }
});
test('tax-inclusive amounts, explicit zero and excluded tax have distinct results', async () => {
  const c = await corePromise, memo = c.createMemo();
  setAmount(memo, 'as_is', 'cleanup', 0);
  setAmount(memo, 'cleanup', 'cleanup', 110000); setAmount(memo, 'cleanup', 'other', 55000);
  setAmount(memo, 'demolition', 'demolition', 100000, 'excluded');
  assert.equal(c.validateMemo(memo).ok, true);
  const plans = c.summarizeMemo(memo).plans;
  assert.equal(plans[0].subtotal, 0); assert.equal(plans[0].subtotalText, '0円'); assert.equal(plans[1].subtotal, 165000);
  assert.equal(plans[2].subtotal, null); assert.equal(plans[2].taxPendingCount, 1);
  assert.match(c.formatMemoText(memo), /100,000円（税別）/);
});
test('included costs are counted once and cannot self-reference, chain or cross plans', async () => {
  const c = await corePromise, memo = c.createMemo();
  setAmount(memo, 'demolition', 'demolition', 300000);
  memo.plans.demolition.costs.cleanup = { status: 'included', amount: null, tax: null, includedIn: 'demolition' };
  assert.equal(c.validateMemo(memo).ok, true); assert.equal(c.summarizeMemo(memo).plans[2].subtotal, 300000);
  for (const target of ['cleanup', 'as_is.demolition', 'survey']) { const bad = structuredClone(memo); bad.plans.demolition.costs.cleanup.includedIn = target; assert.equal(c.validateMemo(bad).ok, false); }
  memo.plans.demolition.costs.exterior = { status: 'included', amount: null, tax: null, includedIn: 'cleanup' };
  assert.equal(c.validateMemo(memo).ok, false);
});
test('all explicitly not planned is distinct from unknown and tax pending is not doubled', async () => {
  const c = await corePromise, memo = c.createMemo();
  for (const cost of c.COST_KEYS) memo.plans.as_is.costs[cost].status = 'not_planned';
  setAmount(memo, 'demolition', 'demolition', 300000, 'unknown');
  memo.plans.demolition.costs.cleanup = { status: 'included', amount: null, tax: null, includedIn: 'demolition' };
  assert.equal(c.summarizeMemo(memo).plans[0].subtotalText, '対象費用なし'); assert.equal(c.summarizeMemo(memo).plans[2].taxPendingCount, 1);
});
test('amount normalization accepts fullwidth integers but rejects malformed or out-of-range text', async () => {
  const c = await corePromise;
  for (const [text, amount] of [['０', 0], ['１１０，０００', 110000], ['100,000,000', 100000000], ['55000', 55000]]) assert.deepEqual(c.parseAmount(text), { ok: true, amount });
  for (const text of ['', '-1', '1.2', '1e5', '100,00', '1,0000,000', '1円', '100000001', 'NaN', 'Infinity']) assert.equal(c.parseAmount(text).ok, false, text);
});
test('strict schema rejects unknown keys, invalid dates, stale amount fields and excessive strings', async () => {
  const c = await corePromise;
  const variants = [
    m => m.subtotal = 123,
    m => m.property.city = 'private-city',
    m => m.property.town = 'あ'.repeat(41),
    m => m.family.keepItems = 'あ'.repeat(101),
    m => m.family.worry = 'あ'.repeat(161),
    m => m.plans.as_is.otherLabel = 'あ'.repeat(21),
    m => m.plans.as_is.checkedOn = '2026-02-30',
    m => m.plans.as_is.costs.cleanup.amount = 0,
    m => m.plans.as_is.costs.cleanup.status = 'constructor',
    m => setAmount(m, 'as_is', 'cleanup', '100')
  ];
  for (const change of variants) { const memo = c.createMemo(); change(memo); assert.equal(c.validateMemo(memo).ok, false); }
  const good = c.createMemo(); good.family.worry = '🧑'.repeat(160); good.plans.as_is.checkedOn = '2024-02-29'; assert.equal(c.validateMemo(good).ok, true);
  for (const input of [null, [], {}, 1]) assert.equal(c.validateMemo(input).ok, false);
});
test('handoff expires at 30 minutes and rejects invalid, future or different-version envelopes', async () => {
  const c = await corePromise, now = Date.parse('2026-10-12T00:00:00Z');
  const envelope = { schemaVersion: 1, createdAt: new Date(now).toISOString(), memo: c.createMemo() };
  assert.equal(c.readHandoff(JSON.stringify(envelope), now).ok, true);
  assert.equal(c.readHandoff(JSON.stringify(envelope), now + c.HANDOFF_TTL - 1).ok, true);
  assert.equal(c.readHandoff(JSON.stringify(envelope), now + c.HANDOFF_TTL).reason, 'expired');
  assert.equal(c.readHandoff(JSON.stringify(envelope), now - 1).reason, 'invalid');
  envelope.schemaVersion = 2; assert.equal(c.readHandoff(JSON.stringify(envelope), now).reason, 'invalid');
  assert.equal(c.readHandoff('{oops', now).reason, 'invalid'); assert.equal(c.readHandoff(null, now).reason, 'missing');
});

async function apiHarness(outcome = 200) {
  const core = await corePromise, sent = [], logs = [];
  const source = read('functions/api/karte-apply.js').replace(/^import .*;\r?\n/m, '').replace(/export async function /g, 'async function ');
  const context = { Request, Response, Date, TextEncoder, validateMemo: core.validateMemo, formatMemoText: core.formatMemoText,
    console: { log: (...args) => logs.push(args) },
    fetch: async (url, opts) => { assert.equal(url, 'https://api.resend.com/emails'); sent.push(JSON.parse(opts.body)); if (outcome === 'network') throw new Error('PRIVATE_BODY'); return new Response('PRIVATE_PROVIDER_BODY', { status: outcome }); }
  };
  vm.createContext(context); vm.runInContext(source + '\nthis.handler=onRequestPost;', context);
  const submit = data => context.handler({ request: new Request('https://example.test/api/karte-apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), env: { RESEND_API_KEY: 'FAKE_TEST_KEY' } });
  return { submit, sent, logs };
}
test('API recomputes a separate memo notification and preserves the ordinary body and recipient', async () => {
  const c = await corePromise, h = await apiHarness(), memo = c.createMemo();
  memo.property.city = '磐田市'; memo.family.worry = '<script>PRIVATE_MEMO</script>'; setAmount(memo, 'cleanup', 'cleanup', 110000); setAmount(memo, 'cleanup', 'other', 55000);
  const response = await h.submit({ addr: '磐田市 PRIVATE_TOWN', mail: 'private@example.com', body: 'あ'.repeat(500), comparisonMemo: memo });
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  assert.deepEqual(h.sent[0].to, ['fudosan@fujigaoka-service.co.jp']); assert.ok(h.sent[0].text.includes('メモ・自由記入: ' + 'あ'.repeat(500)));
  assert.ok(h.sent[0].text.includes('比較メモ（利用者入力）')); assert.ok(h.sent[0].text.includes('入力済みの税込費用小計: 165,000円'));
  assert.ok(h.sent[0].text.includes('<script>PRIVATE_MEMO</script>')); assert.equal(h.sent[0].html, undefined);
  const logs = JSON.stringify(h.logs); for (const privateValue of ['PRIVATE_MEMO', 'PRIVATE_TOWN', 'private@example.com', '110000']) assert.ok(!logs.includes(privateValue));
});
test('API rejects malformed memos and non-object requests without any notification', async () => {
  const c = await corePromise;
  for (const comparisonMemo of [null, {}, { ...c.createMemo(), subtotal: 1 }, (() => { const memo = c.createMemo(); setAmount(memo, 'as_is', 'cleanup', -1); return memo; })()]) {
    const h = await apiHarness(), response = await h.submit({ addr: '磐田市 テスト町', tel: '000-0000-0000', comparisonMemo });
    assert.equal(response.status, 400); assert.equal((await response.json()).error, 'invalid_comparison_memo'); assert.equal(h.sent.length, 0);
  }
  for (const data of [null, [], 3]) { const h = await apiHarness(); assert.equal((await h.submit(data)).status, 400); assert.equal(h.sent.length, 0); }
});
test('API failure never returns success or logs provider bodies; memo-free forms still succeed', async () => {
  const c = await corePromise;
  for (const outcome of [502, 'network']) {
    const h = await apiHarness(outcome), response = await h.submit({ addr: '磐田市 テスト町', mail: 'private@example.com', comparisonMemo: c.createMemo() });
    assert.equal(response.status, 502); assert.equal((await response.json()).ok, false); assert.ok(!JSON.stringify(h.logs).includes('PRIVATE'));
  }
  const h = await apiHarness(); assert.equal((await h.submit({ addr: '磐田市 テスト町', mail: 'test@example.com' })).status, 200); assert.ok(!h.sent[0].text.includes('比較メモ（利用者入力）'));
});
test('memo analytics allow fixed values only and retain internal exclusions', () => {
  for (const internal of [false, true]) {
    const calls = [], context = { URLSearchParams, location: { hostname: 'fudosan.atawi.link', search: internal ? '?fga_internal=1' : '' }, navigator: { userAgent: 'Mozilla' }, document: { cookie: '' }, localStorage: { getItem() {} }, sessionStorage: { getItem() {} }, addEventListener() {}, setInterval() {}, clearInterval() {}, fgaTrack: (name, data) => calls.push(data) }; context.window = context;
    vm.runInNewContext(read('assets/consultation-measurement.js'), context);
    context.fgaMeasurement.track('jikka_memo_start', { tool: 'jikka-memo-v1', step: '1', entry: 'memo', concern: 'undecided', amount: 123, town: 'PRIVATE', comparisonMemo: 'PRIVATE' });
    assert.equal(calls.length, internal ? 0 : 1); if (!internal) assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { tool: 'jikka-memo-v1', step: '1', entry: 'memo', concern: 'undecided' });
  }
});
test('new tool metadata, local links and sitemaps identify one canonical route', () => {
  const route = 'jikka/katazuke-kaitai/memo/', html = read(route + 'index.html');
  assert.equal((html.match(/<h1>/g) || []).length, 1); assert.ok(html.includes('rel="canonical" href="https://fudosan.atawi.link/' + route + '"'));
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) if (match[1].includes('ld+json')) JSON.parse(match[2]);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[^\"]*)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])) || fs.existsSync(path.join(root, match[1] + '.html')), match[1]);
  for (const map of ['sitemap-core.xml', 'jikka/sitemap.xml']) assert.equal(read(map).split('<loc>https://fudosan.atawi.link/' + route + '</loc>').length - 1, 1);
  for (const file of ['jikka/katazuke-kaitai/index.html', 'jikka/katazuke-kaitai/hikaku/index.html', ...['leftover-items', 'demolition-or-old-house', 'after-care-facility', 'faraway-management', 'garden-leak-neighbor'].map(slug => 'jikka/articles/' + slug + '.html')]) assert.ok(read(file).includes('/jikka/katazuke-kaitai/memo/'), file);
});
