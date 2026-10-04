const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const pages = JSON.parse(fs.readFileSync(path.join(root, 'lp/content.json'), 'utf8'));
const script = fs.readFileSync(path.join(root, 'assets/consultation-lp.js'), 'utf8');

function harness(theme = 'parent-care', result = 'ok', search = '', referrer = 'https://example.com/article/?discard=1') {
  const events = [], requests = [], redirects = [], listeners = {};
  const p = pages.find(p => p.slug === theme);
  const fields = {};
  const defaults = {city:'磐田市',town:'架空テスト町',addressDetail:'',contactMethod:'email',mail:'qa@example.com',tel:'09000000000',name:'',company:'',intent:'',body:''};
  for (const [name,value] of Object.entries(defaults)) fields[name] = {value, addEventListener(kind,fn){listeners[name+':'+kind]=fn;}};
  const elements = {
    lpSubmit:{disabled:false,textContent:'申込み'},lpError:{hidden:true,textContent:'',focus(){}},
    'lp-email':{hidden:false},'lp-phone':{hidden:true},lpSticky:{hidden:false},'lp-form-title':{}
  };
  const radios = [{addEventListener(kind,fn){listeners['contact:'+kind]=fn;}},{addEventListener(){}}];
  const form = {dataset:{theme:p.slug,label:p.label,situation:p.situation,comparison:String(!!p.comparison)},elements:{namedItem(name){return fields[name];}},querySelectorAll(){return radios;},addEventListener(kind,fn){listeners[kind]=fn;}};
  const measurement = {excluded:true,track(name,meta){events.push({name,meta});},markSubmit(){events.push({name:'receipt'});},flush(){}};
  const window = {fgaMeasurement:measurement,karteContext:{save(){}},location:{origin:'https://fudosan.atawi.link',pathname:'/lp/'+theme+'/',assign(url){redirects.push(url);}}};
  const document = {getElementById(id){return id==='lpForm'?form:elements[id];},referrer:'https://example.com/article/?discard=1',addEventListener(){}};
  let release;
  const fetch = async (url,options) => {
    requests.push({url,payload:JSON.parse(options.body)});
    if(result==='pending') await new Promise(resolve=>{release=resolve;});
    if(result==='network') throw new Error('network');
    return {ok:result!=='failure',async json(){return result==='failure'?{ok:false,error:'send_failed'}:{ok:true};}};
  };
  window.location.search = search;
  window.location.hostname = 'fudosan.atawi.link';
  document.referrer = referrer;
  vm.runInNewContext(script,{window,document,fetch,URL,URLSearchParams,console});
  return {fields,elements,listeners,events,requests,redirects,release:()=>release(),submit:()=>listeners.submit({preventDefault(){}})};
}

test('referral labels are allowlisted and successes belong only to the current landing source',async()=>{
  for (const [search,referrer,expected] of [
    ['?utm_source=atawi-kaigo','https://example.com/','kaigo'],
    ['','https://iwata-monogatari.net/','monogatari'],
    ['','https://fudosan.atawi.link/blog/article/','blog'],
    ['?utm_source=google&utm_medium=cpc','','google_ads'],
    ['?utm_source=google&utm_medium=organic','','other'],
    ['?utm_source=private@example.com','https://invalid.example/','other']
  ]) {
    const h=harness('parent-care','ok',search,referrer);
    assert.equal(h.events.filter(e=>e.name==='lp_entry_'+expected).length,1);
    assert.equal(h.events.filter(e=>e.name.startsWith('lp_source_success_')).length,0);
    await h.submit();
    assert.equal(h.events.filter(e=>e.name==='lp_source_success_'+expected).length,1);
    assert.ok(!JSON.stringify(h.events).includes('private@example.com'));
  }
  const failed=harness('parent-care','failure','?utm_source=atawi-kaigo');await failed.submit();
  assert.equal(failed.events.filter(e=>e.name.startsWith('lp_source_success_')).length,0);
});

test('all six themes preserve source/situation/intent through the existing application endpoint',async()=>{
  for(const p of pages){
    const h=harness(p.slug);h.fields.intent.value='売る・貸す・残すを比較したい';await h.submit();
    assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'/api/karte-apply');
    const payload=h.requests[0].payload;
    assert.equal(payload.source,'lp/'+p.slug);assert.equal(payload.situation,p.label);assert.equal(payload.stage,h.fields.intent.value);
    assert.equal(payload.pageUrl,'https://fudosan.atawi.link/lp/'+p.slug+'/');assert.equal(payload.referrer,'https://example.com/article/');
    assert.equal(h.redirects[0],'/karte/thanks/?lp='+p.slug);
    assert.equal(h.events.filter(e=>e.name==='lp_application_success').length,1);
    assert.equal(h.events.filter(e=>e.name==='receipt').length,1);
    for(const e of h.events) if(e.meta){assert(!Object.values(e.meta).includes('qa@example.com'));assert(!('addr' in e.meta));assert(!('body' in e.meta));}
  }
});
test('only the selected contact is sent; a hidden stale address does not leak into a phone application',async()=>{
  const h=harness();h.fields.contactMethod.value='phone';h.listeners['contact:change']();
  assert.equal(h.elements['lp-email'].hidden,true);assert.equal(h.fields.mail.disabled,true);assert.equal(h.fields.tel.required,true);
  await h.submit();assert.equal(h.requests[0].payload.mail,'');assert.equal(h.requests[0].payload.tel,'09000000000');
  assert.equal(h.requests[0].payload.follow,'電話で初回連絡希望');
});
for(const result of ['failure','network'])test('failed '+result+' submit retains input and cannot mark a completion',async()=>{
  const h=harness('inheritance',result);await h.submit();
  assert.equal(h.redirects.length,0);assert.equal(h.elements.lpSubmit.disabled,false);assert.equal(h.elements.lpError.hidden,false);
  assert.equal(h.fields.mail.value,'qa@example.com');assert.equal(h.events.filter(e=>e.name==='receipt'||e.name==='lp_application_success').length,0);
});
test('a pending submission cannot send twice',async()=>{
  const h=harness('distant-home','pending');const pending=h.submit();await h.submit();assert.equal(h.requests.length,1);h.release();await pending;assert.equal(h.redirects.length,1);
});
test('whitespace-only town/contact never calls the endpoint',async()=>{
  const h=harness();h.fields.town.value='   ';await h.submit();assert.equal(h.requests.length,0);assert.equal(h.redirects.length,0);
});
test('new canonical pages have valid local destinations, native validation, consistent fictional labeling and matching FAQ schema',()=>{
  for(const p of pages){
    const html=fs.readFileSync(path.join(root,'lp',p.slug,'index.html'),'utf8');
    assert.match(html,new RegExp('https://fudosan.atawi.link/lp/'+p.slug+'/'));
    assert.match(html,/name="city" required/);assert.match(html,/name="privacy" required/);assert.match(html,/name="body" maxlength="500"/);
    assert.match(html,/架空の確認例/);assert.match(html,/県外在住でも相談できます/);
    for(const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:\?[^"#]*)?(?:#[^"]*)?"/g)){
      let relative=match[1].slice(1);if(!relative||relative.endsWith('/'))relative+='index.html';
      assert(fs.existsSync(path.join(root,relative)),p.slug+': missing '+relative);
    }
    for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
      if(match[1].includes('ld+json'))assert.doesNotThrow(()=>JSON.parse(match[2]));
      else if(!match[1].includes('src='))assert.doesNotThrow(()=>new vm.Script(match[2]));
    }
  }
});
