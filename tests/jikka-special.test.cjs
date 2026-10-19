const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const source = read('assets/jikka-special.js');
function harness(search='', pathname='/jikka/katazuke-kaitai/', links=[]) {
  const calls=[], listeners={}, details={open:false}, elements={};
  elements.specialConcern={value:'',addEventListener:(k,f)=>listeners.change=f,closest:()=>details};
  elements.specialContext={hidden:true,textContent:''};
  const window={location:{href:'https://fudosan.atawi.link'+pathname+search,origin:'https://fudosan.atawi.link',pathname,search},fgaMeasurement:{track:(name,data)=>calls.push({name,data})}};
  const document={body:{getAttribute:()=>pathname.startsWith('/jikka/katazuke-kaitai/')?'true':null},getElementById:id=>elements[id],querySelectorAll:()=>links,addEventListener:(k,f)=>listeners[k]=f};
  vm.runInNewContext(source,{window,document,URL,URLSearchParams});
  return {window,calls,listeners,elements,details};
}
function link(href){return {href,getAttribute(){return this.href},setAttribute(k,v){this.href=v}}}
test('article → special → sample → form retains only known editorial keys',()=>{
  const a=link('/jikka/katazuke-kaitai/hikaku/'),b=link('/karte/#apply');
  const h=harness('?entry=leftover-items&concern=belongings',undefined,[a,b]);
  assert.equal(a.href,'/jikka/katazuke-kaitai/hikaku/?entry=leftover-items&concern=belongings');
  const formLink=link('/karte/#apply');
  harness(a.href.slice(a.href.indexOf('?')),'/jikka/katazuke-kaitai/hikaku/',[formLink]);
  assert.equal(formLink.href,'/karte/?entry=leftover-items&concern=belongings#apply');
  const f=harness('?entry=leftover-items&concern=belongings','/karte/');
  assert.equal(f.elements.specialConcern.value,'belongings');assert.equal(f.details.open,true);
  assert.equal(f.window.jikkaSpecial.submission().topic,'荷物が残っている');
  assert.equal(f.window.jikkaSpecial.submission().entry,'leftover-items');
  assert.equal(h.calls[0].name,'jikka_special_view');
});
test('new concern explicitly chosen by visitor overrides inherited concern and tracks clicked choice',()=>{
  const a=link('/karte/?concern=demolition#apply');const h=harness('?entry=jikka&concern=belongings',undefined,[a]);
  assert.equal(a.href,'/karte/?concern=demolition&entry=jikka#apply');
  h.listeners.click({target:{closest:()=>a}});assert.equal(h.calls.at(-1).data.concern,'demolition');
  h.elements.specialConcern.value='distant';h.listeners.change();assert.equal(h.window.jikkaSpecial.submission().topic,'遠方で管理が難しい');
});
test('arbitrary URL values, prototype keys, and unrelated referrers do not enter context',()=>{
  for(const value of ['private@example.com','__proto__','constructor','toString']){
    const h=harness('?entry='+encodeURIComponent(value)+'&concern='+encodeURIComponent(value),'/karte/');
    assert.equal(h.window.jikkaSpecial.submission().topic,'');assert.equal(h.window.jikkaSpecial.submission().entry,'');
    assert.equal(h.window.jikkaSpecial.submission().special,'');assert.equal(h.elements.specialContext.hidden,true);
    h.window.jikkaSpecial.track('jikka_special_application_success');assert.equal(h.calls.length,0);
  }
});
test('special metadata filter rejects private data and test visits emit no events',()=>{
  for(const internal of [false,true]){
    const calls=[];const location={search:internal?'?fga_internal=1':'',hostname:'fudosan.atawi.link'};
    const c={URLSearchParams,location,navigator:{userAgent:'Mozilla'},document:{cookie:'',addEventListener(){}},localStorage:{getItem(){}},sessionStorage:{getItem(){}},addEventListener(){},setInterval(){},clearInterval(){},fgaTrack:(name,data)=>calls.push(data)};c.window=c;
    vm.runInNewContext(read('assets/consultation-measurement.js'),c);
    c.fgaMeasurement.track('jikka_special_application_success',{special:'katazuke-kaitai',entry:'leftover-items',concern:'belongings',addr:'PRIVATE',mail:'private@example.com'});
    assert.equal(calls.length,internal?0:1);if(!internal)assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{special:'katazuke-kaitai',entry:'leftover-items',concern:'belongings'});
  }
});
test('new pages have working local assets/links, structured metadata and unique sitemap URLs',()=>{
  for(const route of ['jikka/katazuke-kaitai/','jikka/katazuke-kaitai/hikaku/']){
    const html=read(route+'index.html');assert.equal((html.match(/<h1>/g)||[]).length,1);
    assert.ok(html.includes('rel="canonical" href="https://fudosan.atawi.link/'+route+'"'));
    for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(m[1].includes('ld+json'))JSON.parse(m[2]);else new vm.Script(m[2]);}
    for(const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[^\"]*)"/g)){
      const p=path.join(root,m[1]);assert.ok(fs.existsSync(p)||fs.existsSync(p+'.html'),m[1]);
    }
    for(const map of ['sitemap-core.xml','jikka/sitemap.xml'])assert.equal(read(map).split('<loc>https://fudosan.atawi.link/'+route+'</loc>').length-1,1);
  }
  assert.match(read('jikka/katazuke-kaitai/hikaku/index.html'),/最終的な手取り額ではありません/);
});
test('real Pages handler builds context notification with mock Resend and preserves failure gate',async()=>{
  const core=await import('../assets/jikka-memo-core.mjs');
  const visit=await import('../assets/jikka-visit-core.mjs');
  const source=read('functions/api/karte-apply.js').replace(/^import .*;\r?\n/mg,'').replace(/export async function /g,'async function ');
  for(const status of [200,502]){
    const sent=[];const c={Request,Response,Date,validateMemo:core.validateMemo,formatMemoText:core.formatMemoText,validateVisitMemo:visit.validateVisitMemo,formatVisitText:visit.formatVisitText,bytes:visit.bytes,console:{log(){}},fetch:async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');sent.push(JSON.parse(opts.body));return new Response('{}',{status})}};
    const {normalizeMoriIntake, moriOperations} = await import('../assets/mori-intake-core.mjs');
    Object.assign(c, {normalizeMoriIntake, moriOperations});
    vm.createContext(c);vm.runInContext(source+'\nthis.handler=onRequestPost;',c);
    const data={addr:'磐田市 テスト町',mail:'test@example.com',topic:'解体するか迷っている',special:'katazuke-kaitai',entry:'demolition-or-old-house',rel:'所有者の家族',stage:'まだ決まっていない',source:'karte/address'};
    const response=await c.handler({request:new Request('https://example.test/api/karte-apply',{method:'POST',body:JSON.stringify(data)}),env:{RESEND_API_KEY:'FAKE_TEST_KEY'}});
    assert.equal(sent.length,1);assert.deepEqual(sent[0].to,['fudosan@fujigaoka-service.co.jp']);
    for(const text of ['解体するか迷っている','特集への入口: demolition-or-old-house','家族','まだ決まっていない'])assert.ok(sent[0].text.includes(text));
    assert.equal((await response.json()).ok,status===200);assert.equal(response.status,status===200?200:502);
  }
});
