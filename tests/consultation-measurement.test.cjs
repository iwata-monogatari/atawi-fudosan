const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'assets/consultation-measurement.js'), 'utf8');
const karte = fs.readFileSync(path.join(root, 'karte/index.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const karteCode = [...karte.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KARTE_API'));
function storage(initial={}) {
 const data=new Map(Object.entries(initial));
 return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};
}
function harness(options={}) {
 const calls=[], google=[], listeners={}, elements={}, intervals=new Map(); let count=0;
 function element(id) { return elements[id] ||= {id,value:'',hidden:false,checked:false,disabled:false,style:{},textContent:'',classList:{add(){},remove(){}},events:{},
 addEventListener(k,cb){(this.events[k] ||= []).push(cb)},dispatch(k){for(const cb of this.events[k]||[])cb({target:this})},setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},checkValidity(){return this.valid!==false},querySelector(){return null}}; }
 const location={href:'https://www.fujigaoka-fudosan.com/karte/'+(options.search||''),hostname:options.host||'www.fujigaoka-fudosan.com',pathname:'/karte/',search:options.search||''};
 const ctx={URL,URLSearchParams,Date,console,location,navigator:{userAgent:options.ua||'Mozilla/5.0',webdriver:!!options.automation},sessionStorage:options.session||storage(),localStorage:options.local||storage(),
 document:{cookie:options.cookie||'',referrer:'',getElementById:element,querySelector(sel){if(sel.includes('contactMethod'))return {value:ctx.method||'email'};if(sel.includes('property'))return {value:'jikka'};return null},querySelectorAll(){return []},addEventListener(k,cb){(listeners['doc:'+k] ||= []).push(cb)}},
 addEventListener(k,cb){(listeners[k] ||= []).push(cb)},setInterval(cb){intervals.set(++count,cb);return count},clearInterval(id){intervals.delete(id)},setTimeout(){},
 gtag(...args){google.push(args)},fetch(){throw Error('Unmocked transport forbidden')},IntersectionObserver:function(cb){ctx.intersection=cb;this.observe=()=>{};this.disconnect=()=>{ctx.disconnected=true}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(helper,ctx);
 function ready(){ctx.fgaTrack=(name,payload)=>calls.push({name,payload:JSON.parse(JSON.stringify(payload))});ctx.fgaMeasurement.flush()}
 function fire(name){for(const cb of listeners[name]||[]) cb({})}
 return {ctx,calls,google,elements,element,ready,fire,intervals,loadPage(){vm.runInContext(karteCode,ctx)}};
}
const prefix='fga_karte-application-funnel-v2_';
test('LP measurement accepts six themes and rejects arbitrary personal metadata',()=>{
 const h=harness();h.ready();
 for(const theme of ['parent-care','inheritance','distant-home','belongings','difficult-property','sell-rent-keep']){
  h.ctx.fgaMeasurement.track('lp_application_success',{lp_theme:theme,page_version:'concern-lp-v1',location:'lp_form',mail:'private@example.com'});
  assert.deepEqual(h.calls.at(-1).payload,{lp_theme:theme,page_version:'concern-lp-v1',location:'lp_form'});
 }
 h.ctx.fgaMeasurement.track('lp_landing',{lp_theme:'private@example.com',location:'private address'});
 assert.deepEqual(h.calls.at(-1).payload,{});
});
test('tracker load race: queue, no premature session flag, ordered one-time handoff',()=>{
 const h=harness();h.ctx.fgaMeasurement.stage('form_start',{funnel_version:'karte-application-funnel-v2'});h.ctx.fgaMeasurement.stage('form_start',{});h.ctx.fgaMeasurement.stage('contact_input',{contact_type:'email'});
 assert.equal(h.ctx.sessionStorage.getItem(prefix+'form_start'),null);assert.equal(h.calls.length,0);h.ready();h.fire('load');h.fire('pageshow');
 assert.deepEqual(h.calls.map(x=>x.name),['karte_application_form_start','karte_application_contact_input']);assert.equal(h.ctx.sessionStorage.getItem(prefix+'form_start'),'1');assert.equal(h.intervals.size,0);
});
test('refresh/back same tab respects old v2 flags, blocked storage still deduplicates page',()=>{
 const session=storage();let h=harness({session});h.ready();h.ctx.fgaMeasurement.stage('form_view',{});h=harness({session});h.ready();h.ctx.fgaMeasurement.stage('form_view',{});assert.equal(h.calls.length,0);
 h=harness({session:{getItem(){throw Error()},setItem(){throw Error()}}});h.ready();h.ctx.fgaMeasurement.stage('form_view',{});h.ctx.fgaMeasurement.stage('form_view',{});assert.equal(h.calls.length,1);
});
test('pre-ready refresh is not persisted as sent, so next observation is eligible',()=>{
 const session=storage();const a=harness({session});a.ctx.fgaMeasurement.stage('form_start',{});const b=harness({session});b.ready();b.ctx.fgaMeasurement.stage('form_start',{});assert.equal(b.calls.length,1);
});
test('canonical event only, legacy names retained only for existing Google events',()=>{
 const h=harness();h.ready();for(const name of ['line_click','tel_click','email_click','form_submit_success','form_complete','karte_apply_click'])h.ctx.fgaMeasurement.track(name,{route:'address'});
 assert.deepEqual(h.calls.map(x=>x.name),['line_consult','phone_consult','email_consult','form_consult','karte_consult']);assert.equal(h.google[0][1],'line_click');
});
test('only enumerated metadata: never email, phone, address, arbitrary server errors or identifiers',()=>{
 const h=harness();h.ready();h.ctx.fgaMeasurement.track('form_complete',{route:'address',contact_type:'email',mail:'private@example.com',tel:'09012345678',addr:'PRIVATE ADDRESS',url:'PRIVATE URL',client_id:'secret',reason:'private@example.com',city:'PRIVATE ADDRESS',count:100});
 assert.deepEqual(h.calls[0].payload,{route:'address',contact_type:'email'});assert.equal(JSON.stringify(h.google).includes('private'),false);
});
for(const options of [{search:'?check=1'},{search:'?codex_chrome_check=1'},{search:'?fga_ignore=1'},{search:'?fga_internal=1'},{search:'?admin_check=1'},{search:'?preview=1'},{host:'preview.pages.dev'},{host:'localhost'},{automation:true},{ua:'ChatGPT'},{local:storage({fujigaokaAnalyticsInternal:'1'})},{cookie:'fujigaokaAnalyticsIgnore=1'}]) test('exclude internal/test '+JSON.stringify(options),()=>{
 const h=harness(options);h.ready();h.ctx.fgaMeasurement.track('line_click',{});h.ctx.fgaMeasurement.stage('form_view',{});assert.equal(h.calls.length,0);assert.equal(h.google.length,0);assert.equal(h.ctx.sessionStorage.getItem(prefix+'form_view'),null);
});
test('tracker throwing after handoff never retries an ambiguous event',()=>{
 const h=harness();let n=0;h.ctx.fgaTrack=()=>{n++;throw Error('ambiguous')};h.ctx.fgaMeasurement.stage('complete',{});h.ctx.fgaMeasurement.flush();h.ctx.fgaMeasurement.stage('complete',{});assert.equal(n,1);
});
test('input/change/autofill/page restore captures selected contact once, no values',()=>{
 const h=harness();h.ready();h.loadPage();h.element('mail').value='private@example.com';h.element('mail').dispatch('change');h.element('mail').dispatch('input');h.fire('pageshow');
 assert.equal(h.calls.filter(x=>x.name==='karte_application_contact_input').length,1);assert.equal(JSON.stringify(h.calls).includes('private'),false);
});
test('switching contact type clears old field; hidden autofill not counted',()=>{
 const h=harness();h.ready();h.loadPage();h.element('mail').value='private@example.com';h.ctx.method='phone';h.ctx.setContactMethod('phone');assert.equal(h.element('mail').value,'');h.element('mail').value='hidden@example.com';h.element('mail').dispatch('change');assert.equal(h.calls.filter(x=>x.name==='karte_application_contact_input').length,0);
 h.element('tel').value='09012345678';h.element('tel').dispatch('change');h.ctx.method='email';h.ctx.setContactMethod('email');h.element('mail').value='new@example.com';h.element('mail').dispatch('input');assert.equal(h.calls.filter(x=>x.name==='karte_application_contact_input').length,1);assert.equal(h.calls.find(x=>x.name==='karte_application_contact_input').payload.contact_type,'phone');
});
test('form view requires at least 50 percent, not merely intersecting',()=>{
 const h=harness();h.ready();h.loadPage();h.ctx.intersection([{isIntersecting:true,intersectionRatio:0.01}]);assert.equal(h.calls.length,0);h.ctx.intersection([{isIntersecting:true,intersectionRatio:0.5}]);assert.equal(h.calls[0].name,'karte_application_form_view');assert.equal(h.ctx.disconnected,true);
});
function valid(h){h.element('city').value='磐田市';h.element('town').value='見付';h.element('mail').value='private@example.com';h.element('privacy').checked=true;}
for(const outcome of ['ok','http-fail','data-fail','network-fail','json-fail']) test('mocked form submission '+outcome,async()=>{
 const h=harness();h.ready();h.loadPage();valid(h);let requests=0;h.ctx.fetch=async(url)=>{requests++;assert.equal(url,'/api/karte-apply');if(outcome==='network-fail')throw Error('private@example.com');return {ok:outcome!=='http-fail',json:async()=>{if(outcome==='json-fail')throw Error('private@example.com');return {ok:outcome!=='data-fail',error:'private@example.com'}}}};
 await h.ctx.submitUnifiedKarte({preventDefault(){}});assert.equal(requests,1);assert.equal(h.calls.filter(x=>x.name==='form_consult').length,0);assert.equal(h.calls.filter(x=>x.name==='karte_application_complete').length,outcome==='ok'?1:0);assert.equal(h.calls.filter(x=>x.name==='karte_application_contact_input').length,1);assert.equal(JSON.stringify(h.calls).includes('private'),false);assert.equal(h.element('applyBtn').disabled,outcome==='ok');
});
test('duplicate submit calls while pending send one application and one completion',async()=>{
 const h=harness();h.ready();h.loadPage();valid(h);let resolve,requests=0;h.ctx.fetch=()=>{requests++;return new Promise(r=>resolve=r)};const first=h.ctx.submitUnifiedKarte({preventDefault(){}});await h.ctx.submitUnifiedKarte({preventDefault(){}});assert.equal(requests,1);resolve({ok:true,json:async()=>({ok:true})});await first;assert.equal(h.calls.filter(x=>x.name==='form_consult').length,0);
});
test('validation failure has no application request or completion',async()=>{
 const h=harness();h.ready();h.loadPage();await h.ctx.submitUnifiedKarte({preventDefault(){}});assert.equal(h.calls.filter(x=>x.name==='application_error').length,1);assert.equal(h.calls.filter(x=>x.name==='karte_application_complete'||x.name==='form_consult').length,0);
});
test('helper asset failure cannot prevent successful form submission',async()=>{
 const h=harness();delete h.ctx.fgaMeasurement;h.loadPage();valid(h);h.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true})});await h.ctx.submitUnifiedKarte({preventDefault(){}});assert.equal(h.ctx.location.href,'/karte/thanks/');
});
test('top has explicit single-owner consultation links and duplicate-submit guards',()=>{
 for(const match of home.matchAll(/<a\b[^>]*href="(?:tel:|mailto:|https:\/\/(?:line\.me|lin\.ee)\/)[^"]*"[^>]*>/g))assert.match(match[0],/onclick="trackEvent\('/);
 assert.match(home,/a.setAttribute\('onclick', "trackEvent\('line_click'/);assert.match(home,/if\(document.getElementById\('applyBtn'\).disabled\)\{ return; \}/);assert.match(home,/if\(document.getElementById\('taxNoticeSubmit'\).disabled\)\{ return; \}/);
});
test('all inline JS syntax checks',()=>{for(const [name,html] of [['home',home],['karte',karte]])for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!m[1].includes('ld+json'))new vm.Script(m[2],{filename:name})}});
function functionSource(html,name){const start=html.search(new RegExp('(?:async )?function '+name+'\\('));assert.notEqual(start,-1);const end=html.indexOf('\n}',start)+2;return html.slice(start,end)}
function topHarness(){const h=harness();h.ready();Object.assign(h.ctx,{KARTE_API:'/api/karte-apply',PAGE_VERSION:'intent-first-v1',FUNNEL_VERSION:'application-funnel-v2',funnelStageSeen:{},routeFormStarted:{},formStarted:false,selectedSituation:'',SITUATION_LABEL:{care:'親の施設入居・転居'},PROPERTY_LABEL:{jikka:'実家・親の家'}});
 for(const name of ['trackEvent','trackFunnelStage','getPropertyKind','markFormStart','markRouteFormStart','setFieldError','clearFieldError','trackFormError','postKarte','isSupportedKarteAddress','submitKarte']) vm.runInContext(functionSource(home,name),h.ctx);return h;}
for(const outcome of ['ok','http-fail','data-fail','network-fail'])test('top address actual success gate '+outcome,async()=>{
 const h=topHarness();valid(h);h.ctx.fetch=async()=>{if(outcome==='network-fail')throw Error();return {ok:outcome!=='http-fail',json:async()=>({ok:outcome!=='data-fail'})}};await h.ctx.submitKarte({preventDefault(){}});assert.equal(h.calls.filter(x=>x.name==='form_consult').length,outcome==='ok'?1:0);assert.equal(JSON.stringify(h.calls).includes('private'),false);
});
test('top duplicate submit pending yields one request and completion',async()=>{
 const h=topHarness();valid(h);let resolve,n=0;h.ctx.fetch=()=>{n++;return new Promise(r=>resolve=r)};const first=h.ctx.submitKarte({preventDefault(){}});await h.ctx.submitKarte({preventDefault(){}});assert.equal(n,1);resolve({ok:true,json:async()=>({ok:true})});await first;assert.equal(h.calls.filter(x=>x.name==='form_consult').length,1);
});
test('CSV report old/new aliases share existing set key, without fetching export',()=>{
 const src=fs.readFileSync(path.join(root,'_tools/ads-funnel-report.mjs'),'utf8');const c={};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('const CV_EVENTS ='),src.indexOf('/* 流入面'))+';this.events=CV_EVENTS',c);
 const cv={};for(const label of Object.keys(c.events))cv[label]=new Set();for(const event of ['line_click','line_consult','tel_click','phone_consult','form_complete','form_submit_success','form_consult'])for(const [label,names]of Object.entries(c.events))if(names.includes(event))cv[label].add('fixture-existing-key');assert.deepEqual(Object.values(cv).map(s=>s.size),[1,1,1]);assert.equal(c.events['フォーム'].includes('karte_application_complete'),false);
});
test('actual current tracker capture skips inline-owned links (one click POST only)',()=>{
 const h=harness();const transport=[];h.ctx.document.currentScript={src:'https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js',getAttribute:k=>k==='data-site'?'atawi-fudosan':null};h.ctx.fetch=(url,opts)=>{transport.push({url,body:JSON.parse(opts.body)});return Promise.resolve({ok:true})};
 let capture;h.ctx.document.addEventListener=(kind,cb)=>{if(kind==='click')capture=cb};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'fixtures/fga-tracker-20260930.js'),'utf8'),h.ctx);
 const link={matches:s=>s==='a[href]',getAttribute:k=>k==='onclick'?"trackEvent('line_click')":k==='href'?'https://line.me/R/ti/p/example':null};capture({target:link});h.ctx.fgaMeasurement.track('line_click',{location:'apply_shared'});
 assert.equal(transport.filter(x=>x.url.endsWith('/api/click')).length,1);assert.equal(transport.find(x=>x.url.endsWith('/api/click')).body.event_name,'line_consult');
});
test('loading helper twice does not install duplicate handlers or lose queued events',()=>{
 const h=harness();h.ctx.fgaMeasurement.stage('form_start',{});vm.runInContext(helper,h.ctx);h.ready();h.fire('load');assert.equal(h.calls.length,1);
});
const thanks = fs.readFileSync(path.join(root,'karte/thanks/index.html'),'utf8');
const thanksCode=[...thanks.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function trackEvent'));
const adsCode=fs.readFileSync(path.join(root,'assets/ads-conversion.js'),'utf8');
function thanksHarness(session,ready=true){const h=harness({session});h.ctx.location.pathname='/karte/thanks/';vm.runInContext(thanksCode,h.ctx);vm.runInContext(adsCode,h.ctx);if(ready)h.ready();h.fire('load');return h;}
test('karte success → thanks → reload: one canonical completion, one ad conversion, one stage',async()=>{
 const h=harness();h.ready();h.loadPage();valid(h);h.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true})});await h.ctx.submitUnifiedKarte({preventDefault(){}});
 assert.notEqual(h.ctx.sessionStorage.getItem('fgaKarteSubmit'),null);assert.equal(h.calls.filter(x=>x.name==='form_consult').length,0);
 const t=thanksHarness(h.ctx.sessionStorage),r=thanksHarness(h.ctx.sessionStorage);const calls=[...h.calls,...t.calls,...r.calls];assert.equal(calls.filter(x=>x.name==='form_consult').length,1);assert.equal(calls.filter(x=>x.name==='karte_application_complete').length,1);assert.equal([...t.google,...r.google].filter(x=>x[1]==='conversion').length,1);
});
test('late trackers through redirect still yield one thanks completion; stage flag not premature',async()=>{
 const h=harness();h.loadPage();valid(h);h.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true})});await h.ctx.submitUnifiedKarte({preventDefault(){}});assert.equal(h.ctx.sessionStorage.getItem(prefix+'complete'),null);
 const t=thanksHarness(h.ctx.sessionStorage,false);assert.equal(t.calls.length,0);t.ready();assert.equal(t.calls.filter(x=>x.name==='form_consult').length,1);assert.equal(t.calls.filter(x=>x.name==='karte_application_complete').length,1);
});
test('thanks direct, expired receipt, and reload do not imply successful application',()=>{
 for(const session of [storage(),storage({fgaKarteSubmit:String(Date.now()-31*60*1000)})]){const h=thanksHarness(session);assert.equal(h.calls.length,0);assert.equal(h.google.filter(x=>x[1]==='conversion').length,0)}
});
test('all thank-you inline JavaScript parses',()=>{for(const m of thanks.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!m[1].includes('ld+json'))new vm.Script(m[2])}});
test('excluded consultation pages do not mark successful receipts or emit ad conversions',()=>{
 const h=harness({search:'?fga_internal=1'});h.ctx.fgaMeasurement.markSubmit();assert.equal(h.ctx.sessionStorage.getItem('fgaKarteSubmit'),null);vm.runInContext(adsCode,h.ctx);assert.equal(typeof h.ctx.fgaAdsConversion,'undefined');assert.equal(h.google.length,0);
});
