const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.join(__dirname,'..');
const context = {campaign:'mori_jikka_20261018',entry:'hub_sale',intent:'sale'};

test('real intake handler sends the same receipt and requested next action to the fixed recipient; no receipt on failure',async()=>{
  const {onRequestPost} = await import(pathToFileURL(path.join(root,'functions/api/karte-apply.js')));
  const original=global.fetch;
  try {
    for(const intent of ['sale','organize']) {
      let sent;
      global.fetch=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');sent=JSON.parse(init.body);return new Response('{}',{status:200});};
      const response=await onRequestPost({request:new Request('https://example.test/api/karte-apply',{method:'POST',body:JSON.stringify({addr:'森町 テスト町',mail:'qa@example.test',moriIntake:{...context,intent}})}),env:{RESEND_API_KEY:'test-only'}});
      const result=await response.json();
      assert.equal(response.status,200);assert.match(result.receipt.id,/^MORI-[A-F0-9]{12}$/);
      assert.deepEqual(sent.to,['fudosan@fujigaoka-service.co.jp']);assert.equal(sent.reply_to,'qa@example.test');
      assert.ok(sent.text.includes(result.receipt.id));assert.ok(sent.text.includes('hub_sale'));
      assert.ok(sent.subject.includes(intent==='sale'?'森町売却相談':'森町実家整理'));
      assert.ok(sent.text.includes(intent==='sale'?'現地確認の方法・日程':'カルテを送付'));
      assert.ok(!JSON.stringify(result).includes('qa@example.test'));
    }
    global.fetch=async()=>new Response('failure',{status:503});
    const response=await onRequestPost({request:new Request('https://example.test/api/karte-apply',{method:'POST',body:JSON.stringify({addr:'森町 テスト町',tel:'0538313308',moriIntake:context})}),env:{RESEND_API_KEY:'test-only'}});
    assert.equal(response.status,502);assert.deepEqual(await response.json(),{ok:false,error:'send_failed'});
  } finally {global.fetch=original;}
});

test('invalid attribution, bot and other-town payloads never create a Mori receipt or notify',async()=>{
  const {onRequestPost} = await import(pathToFileURL(path.join(root,'functions/api/karte-apply.js')));
  const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('unexpected send');};
  try {
    for(const data of [{addr:'磐田市 見付',moriIntake:context},{addr:'森町 森',moriIntake:{...context,entry:'private@example.test'}},{addr:'森町 森',moriIntake:{...context,intent:'<script>'}}]) {
      const r=await onRequestPost({request:new Request('https://example.test/',{method:'POST',body:JSON.stringify({mail:'qa@example.test',...data})}),env:{RESEND_API_KEY:'test'}});
      assert.equal(r.status,400);assert.equal((await r.json()).receipt,undefined);
    }
    const r=await onRequestPost({request:new Request('https://example.test/',{method:'POST',body:JSON.stringify({company:'bot',moriIntake:context})}),env:{RESEND_API_KEY:'test'}});
    assert.deepEqual(await r.json(),{ok:true});assert.equal(calls,0);
  } finally {global.fetch=original;}
});

function browser(search='',pathname='/karte/',initial={}) {
  const store=new Map(Object.entries(initial)),events=[],handlers={},elements={};
  const el=id=>elements[id] ||= {value:id==='city'?'森町':'',hidden:true,disabled:false,textContent:'',addEventListener(name,fn){this[name]=fn;}};
  const ctx={URL,URLSearchParams,Date,location:{search,pathname,href:'https://fudosan.atawi.link'+pathname+search,origin:'https://fudosan.atawi.link'},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{readyState:'complete',getElementById:el,querySelectorAll:()=>[],addEventListener(k,fn){handlers[k]=fn;}},fgaMeasurement:{track(name,extra){events.push({name,extra});}},IntersectionObserver:function(fn){this.observe=()=>fn([{isIntersecting:true}]);this.disconnect=()=>{};}};
  // Defer the observer callback as real browsers do.
  ctx.IntersectionObserver=function(fn){ctx.observe=()=>fn([{isIntersecting:true}]);this.observe=()=>{};this.disconnect=()=>{};};
  ctx.window=ctx;vm.runInNewContext(fs.readFileSync(path.join(root,'assets/mori-intake.js'),'utf8'),ctx);
  return {ctx,store,events,el,handlers};
}
const query='?area=%E6%A3%AE%E7%94%BA&utm_source=morimachi_lifehack&utm_campaign=mori_jikka_20261018&utm_content=hub_sale&intent=sale';
test('visible intent is editable, failures do not count, receipt counts only once, no personal data in events/storage',()=>{
  const h=browser(query);h.ctx.observe();assert.equal(h.el('moriIntakeContext').hidden,false);assert.match(h.el('applyHeading').textContent,/売却/);
  h.el('moriIntent').value='organize';h.el('moriIntent').change();assert.equal(h.ctx.moriIntake.payload().intent,'organize');
  h.ctx.moriIntake.failure();h.ctx.moriIntake.accepted({ok:true});assert.ok(!h.events.some(x=>x.name.endsWith('_accepted')));
  h.ctx.moriIntake.accepted({ok:true,receipt:{id:'MORI-123456ABCDEF'}});h.ctx.moriIntake.accepted({ok:true,receipt:{id:'MORI-123456ABCDEF'}});
  assert.equal(h.events.filter(x=>x.name==='mori_jikka_organize_accepted').length,1);
  assert.equal(h.events.filter(x=>x.name==='mori_growth_existing_accepted').length,1);assert.ok(h.store.has('mori_intake_receipt_v1'));
  assert.ok(!JSON.stringify(h.events).includes('MORI-123456ABCDEF'));
  h.el('city').value='磐田市';h.el('city').change();assert.equal(h.ctx.moriIntake.payload(),undefined);assert.equal(h.el('moriIntakeContext').hidden,true);
});
test('thanks direct access/reload never counts a conversion; valid receipt displays without URL leakage',()=>{
  const receipt={...context,id:'MORI-123456ABCDEF',at:Date.now()};
  for(const initial of [{},{mori_intake_receipt_v1:JSON.stringify(receipt)}]) {
    const h=browser('','/karte/thanks/',initial);assert.equal(h.events.length,0);
    assert.equal(h.el('moriReceipt').hidden,!initial.mori_intake_receipt_v1);
  }
});
test('sample retains fixed context; other campaign and expired context cannot inherit stale intent',()=>{
  const saved=JSON.stringify({...context,at:Date.now()});
  assert.equal(browser('','/karte/sample/',{mori_intake_v1:saved}).ctx.moriIntake.payload().intent,'sale');
  assert.equal(browser('?utm_source=other','/karte/',{mori_intake_v1:saved}).ctx.moriIntake.payload(),undefined);
  assert.equal(browser('','/karte/',{mori_intake_v1:JSON.stringify({...context,at:Date.now()-1800001})}).ctx.moriIntake.payload(),undefined);
});

test('new Mori growth entries survive sample-to-form and are accepted by server allowlist',async()=>{
  const {normalizeMoriIntake}=await import(pathToFileURL(path.join(root,'assets/mori-intake-core.mjs')));
  for(const entry of ['growth_home','growth_blog','growth_owner']) {
    const incoming=query.replace('hub_sale',entry).replace('intent=sale','intent=organize');
    const sample=browser(incoming,'/karte/sample/');
    assert.equal(sample.events.filter(x=>x.name==='mori_growth_'+entry.slice(7)+'_sample_view').length,1);
    const h=browser('','/karte/',Object.fromEntries(sample.store));
    assert.equal(h.ctx.moriIntake.payload().entry,entry);
    assert.equal(normalizeMoriIntake(h.ctx.moriIntake.payload(),'森町 森').entry,entry);
    h.ctx.moriIntake.accepted({ok:true,receipt:{id:'MORI-123456ABCDEF'}});
    assert.equal(h.events.filter(x=>x.name==='mori_growth_'+entry.slice(7)+'_accepted').length,1);
  }
});

test('LINE guide retains source and counts actual LINE open separately from form arrivals and acceptance',()=>{
  const h=browser(query.replace('hub_sale','growth_blog'),'/karte/line/');
  assert.ok(!h.events.some(x=>x.name.endsWith('_landing')||x.name.endsWith('_accepted')));
  const anchor={href:'https://line.me/R/ti/p/example',getAttribute(){return this.href;}};
  h.handlers.click({target:{closest(){return anchor;}}});
  h.handlers.click({target:{closest(){return anchor;}}});
  assert.equal(h.events.filter(x=>x.name==='mori_growth_blog_line_click').length,1);
  assert.ok(!h.events.some(x=>x.name.endsWith('_accepted')));
  const html=fs.readFileSync(path.join(root,'karte/line/index.html'),'utf8');
  assert.match(html,/tracker\.js/);assert.match(html,/mori-intake\.js/);
});
