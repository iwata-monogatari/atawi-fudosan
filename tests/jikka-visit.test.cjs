const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const core = import('../assets/jikka-visit-core.mjs');
const comparison = import('../assets/jikka-memo-core.mjs');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('blank visit memo retains twelve unknown observations and no automatic rating', async () => {
  const c = await core, memo = c.createVisitMemo(); assert.equal(c.validateVisitMemo(memo).ok, true);
  assert.equal(c.ITEMS.length, 12); assert.equal(new Set(c.ITEMS.map(item => item.id)).size, 12);
  assert.deepEqual(c.summarizeVisit(memo).counts, { unknown: 12, checked: 0, unavailable: 0, ask: 0 });
});
test('status ordering remains stable and photo never implies a checked observation', async () => {
  const c = await core, memo = c.createVisitMemo(); memo.items.exterior.record = 'photo'; memo.items.utilities.status = 'ask'; memo.items.garden.status = 'unavailable'; memo.items.entrance.status = 'checked';
  const value = c.validateVisitMemo(memo); assert.equal(value.ok, true); const summary = c.summarizeVisit(value.memo);
  assert.equal(value.memo.items.exterior.status, 'unknown'); assert.equal(Object.values(summary.counts).reduce((a,b) => a+b), 12);
  assert.match(summary.actions[0], /^公共料金/); assert.match(summary.actions[1], /^庭木/); assert.match(summary.actions[2], /^外観/);
  for (const item of c.ITEMS) memo.items[item.id].status = 'checked'; assert.deepEqual(c.summarizeVisit(memo).actions, ['確認結果を家族と共有し、必要なら相談しましょう。']);
});
test('Unicode limits, CRLF normalization and note-only records enforce their contract', async () => {
  const c = await core, memo = c.createVisitMemo(); memo.items.exterior.note = '😀'.repeat(80); memo.items.exterior.record = 'note'; memo.question = '検討'.repeat(80); assert.equal(c.validateVisitMemo(memo).ok, true);
  memo.items.exterior.note += '😀'; assert.equal(c.validateVisitMemo(memo).ok, false); memo.items.exterior.note = '  1\r\n2\r3  '; assert.equal(c.validateVisitMemo(memo).memo.items.exterior.note, '1\n2\n3');
  memo.items.exterior.note = ''; assert.ok(c.validateVisitMemo(memo).errors['items.exterior.note']); memo.items.exterior.record = 'none'; assert.equal(c.validateVisitMemo(memo).ok, true);
  memo.question += 'x'; assert.ok(c.validateVisitMemo(memo).errors.question);
});
test('Japanese current day and real date validation reject future checked dates but permit plans', async () => {
  const c = await core, now = Date.parse('2026-10-11T15:00:00.000Z'), memo = c.createVisitMemo(); assert.equal(c.japanDate(now), '2026-10-12');
  memo.visit.checkedOn = '2026-10-12'; memo.visit.plannedOn = '2100-12-31'; assert.equal(c.validateVisitMemo(memo, now).ok, true);
  for (const value of ['2026-10-13', '2026-02-30', '1899-12-31', 20261012, '']) { memo.visit.checkedOn = value; assert.equal(c.validateVisitMemo(memo, now).ok, false); }
});
test('strict schema rejects missing rows, dangerous keys, enum injection and too many concerns', async () => {
  const c = await core;
  for (const mutate of [m=>m.score=100, m=>delete m.items.road, m=>m.property.city='Other', m=>m.visit.concerns=['building','building'], m=>m.visit.concerns=['building','garden','access','documents'], m=>m.items.road.status='safe', m=>m.property.town='x'.repeat(41), m=>m.question='\u0000']) {
    const memo=c.createVisitMemo(); mutate(memo); assert.equal(c.validateVisitMemo(memo).ok,false);
  }
  const dangerous=JSON.parse(JSON.stringify(c.createVisitMemo()).replace('"schemaVersion":1','"schemaVersion":1,"__proto__":{}')); assert.equal(c.validateVisitMemo(dangerous).ok,false);
});
test('editing file survives days while handoff expires at exactly thirty minutes', async () => {
  const c=await core, now=Date.parse('2026-10-12T00:00:00.000Z'), memo=c.createVisitMemo(); memo.question='<script>PRIVATE</script>';
  const raw=c.serializeVisitFile(memo,now); assert.ok(c.readVisitFile(raw,now+7*86400000).ok); assert.equal(c.readVisitFile(raw,now).memo.question,memo.question);
  const handoff=JSON.stringify({schemaVersion:1,createdAt:new Date(now).toISOString(),memo}); assert.ok(c.readVisitHandoff(handoff,now+c.VISIT_TTL-1).ok); assert.equal(c.readVisitHandoff(handoff,now+c.VISIT_TTL).reason,'expired'); assert.equal(c.readVisitHandoff(handoff,now-1).reason,'invalid');
});
test('file and handoff corruption never become usable imported data', async () => {
  const c=await core, now=Date.now(), raw=c.serializeVisitFile(c.createVisitMemo(),now);
  for (const value of ['', '{}', '{broken', 'x'.repeat(32769), raw.replace('"fileVersion": 1','"fileVersion": 2'), raw.replace('"kind": "atawi-jikka-visit"','"kind": "other"')]) assert.equal(c.readVisitFile(value,now).ok,false);
  for (const value of [JSON.stringify({schemaVersion:1,createdAt:'yesterday',memo:c.createVisitMemo()}), JSON.stringify({schemaVersion:2,createdAt:new Date(now).toISOString(),memo:c.createVisitMemo()})]) assert.equal(c.readVisitHandoff(value,now).ok,false);
});
async function harness(outcome=200) {
  const c=await core, m=await comparison, sent=[], logs=[];
  const source=read('functions/api/karte-apply.js').replace(/^import .*;\r?\n/mg,'').replace(/export async function /g,'async function ');
  const ctx={Request,Response,Date,TextEncoder,validateMemo:m.validateMemo,formatMemoText:m.formatMemoText,validateVisitMemo:c.validateVisitMemo,formatVisitText:c.formatVisitText,bytes:c.bytes,console:{log:(...args)=>logs.push(args)},fetch:async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails'); sent.push(JSON.parse(opts.body)); if(outcome==='network')throw Error('PRIVATE_PROVIDER'); return new Response('PRIVATE_PROVIDER',{status:outcome});}};
  const {normalizeMoriIntake, moriOperations} = await import('../assets/mori-intake-core.mjs');
  Object.assign(ctx, {normalizeMoriIntake, moriOperations});
  vm.createContext(ctx); vm.runInContext(source+'\nthis.handler=onRequestPost;',ctx);
  return {sent,logs,submit:data=>ctx.handler({request:new Request('https://example.test/api/karte-apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),env:{RESEND_API_KEY:'FAKE_KEY'}})};
}
test('all four attachment combinations produce one notification and preserve the full ordinary body', async () => {
  const c=await core,m=await comparison;
  for(const [visit,compare] of [[false,false],[true,false],[false,true],[true,true]]) {
    const h=await harness(), payload={addr:'磐田市 PRIVATE_TOWN',mail:'private@example.com',body:'あ'.repeat(500)};
    if(visit){payload.visitMemo=c.createVisitMemo();payload.visitMemo.items.road.status='ask';payload.visitMemo.question='PRIVATE_VISIT';}
    if(compare)payload.comparisonMemo=m.createMemo();
    const res=await h.submit(payload);assert.equal(res.status,200);assert.equal(h.sent.length,1);assert.equal((await res.json()).ok,true);
    assert.equal(h.sent[0].text.includes('現地確認メモ 利用者の記録'),visit);assert.equal(h.sent[0].text.includes('比較メモ（利用者入力）'),compare);assert.ok(h.sent[0].text.includes('あ'.repeat(500)));assert.deepEqual(h.sent[0].to,['fudosan@fujigaoka-service.co.jp']);
    assert.ok(!JSON.stringify(h.logs).includes('PRIVATE'));assert.ok(!JSON.stringify(h.logs).includes('private@example.com'));
  }
});
test('invalid either memo rejects both without a notification and provider failure never means success', async () => {
  const c=await core,m=await comparison;
  for(const payload of [{visitMemo:null},{visitMemo:{}},{visitMemo:c.createVisitMemo(),comparisonMemo:null}]) {const h=await harness(); const res=await h.submit({addr:'磐田市 架空町',tel:'0000000000',...payload});assert.equal(res.status,400);assert.equal(h.sent.length,0);}
  for(const outcome of [502,'network']){const h=await harness(outcome); const res=await h.submit({addr:'磐田市 架空町',mail:'test@example.com',visitMemo:c.createVisitMemo(),comparisonMemo:m.createMemo()});assert.equal(res.status,502);assert.equal((await res.json()).ok,false);assert.ok(!JSON.stringify(h.logs).includes('PRIVATE_PROVIDER'));}
});
test('new canonical and form assets resolve locally and sitemaps contain it once each', () => {
  const html=read('jikka/visit-memo/index.html');assert.match(html,/<link rel="canonical" href="https:\/\/fudosan\.atawi\.link\/jikka\/visit-memo\/">/);assert.match(html,/<noscript>/);
  for(const m of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)){const local=path.join(root,m[1]);assert.ok(fs.existsSync(local)||fs.existsSync(path.join(local,'index.html')),m[1]);}
  for(const name of ['sitemap-core.xml','jikka/sitemap.xml'])assert.equal((read(name).match(/<loc>https:\/\/fudosan\.atawi\.link\/jikka\/visit-memo\/<\/loc>/g)||[]).length,1);
  assert.match(read('karte/index.html'),/visitMemo: visitMemo/);assert.match(read('karte/index.html'),/id="visitHandoffInclude"/);
});
test('visit analytics allow only fixed metadata and retain internal exclusion', () => {
  for(const internal of [false,true]) {
    const calls=[], store={getItem:()=>null,setItem(){},removeItem(){}}, ctx={window:null,URLSearchParams,addEventListener(){},document:{cookie:'',referrer:'',addEventListener(){}},location:{search:internal?'?check=1':'',hostname:'fudosan.atawi.link',pathname:'/jikka/visit-memo/'},navigator:{userAgent:'test'},localStorage:store,sessionStorage:store,setInterval:()=>0,clearInterval(){},fgaTrack:(name,data)=>calls.push(data)};
    ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('assets/consultation-measurement.js'),ctx);ctx.fgaMeasurement.track('jikka_visit_start',{tool:'jikka-visit-v1',step:'2',entry:'visit-memo',note:'PRIVATE',file:'PRIVATE',visitMemo:'PRIVATE',checkedOn:'2026-10-12'});
    assert.equal(calls.length,internal?0:1);if(!internal)assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{tool:'jikka-visit-v1',step:'2',entry:'visit-memo'});
  }
});
