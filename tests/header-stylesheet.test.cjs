const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../functions/_middleware.js'),'utf8');
function load(){
 const handlers=[];
 class HTMLRewriter {on(selector,handler){handlers.push({selector,handler});return this}transform(response){return response}}
 const ctx={URL,Response,HTMLRewriter};vm.createContext(ctx);vm.runInContext(source.replaceAll('export ', '')+'\nthis.route=onRequest;this.rewrite=headerStylesheetHref;',ctx);
 return {...ctx,handlers};
}
test('existing header CSS references get one fresh version and preserve other query data',()=>{
 const {rewrite}=load();
 assert.equal(rewrite('/assets/site-header.css?v=20261010-mobile'),'/assets/site-header.css?v=20261030-text200');
 assert.equal(rewrite('/assets/site-header.css'),'/assets/site-header.css?v=20261030-text200');
 assert.equal(rewrite('/assets/site-header.css?theme=sky&v=old#anchor'),'/assets/site-header.css?theme=sky&v=20261030-text200#anchor');
 assert.equal(rewrite(rewrite('/assets/site-header.css?v=old')),rewrite('/assets/site-header.css?v=old'));
});
test('unrelated, external, absent and similarly named assets are unchanged',()=>{
 const {rewrite}=load();for(const href of [null,undefined,'','/assets/site-header.css.map','/assets/site-header.css-extra','/assets/other.css?v=old','https://other.example/assets/site-header.css?v=old','/api/karte-apply'])assert.equal(rewrite(href),href);
});
test('HTML cache refresh changes only the matched stylesheet href and retains footer hooks',async()=>{
 const h=load();const response=new Response('<html></html>',{headers:{'content-type':'text/html'}});let fetched=0;
 const result=await h.route({request:new Request('https://fudosan.atawi.link/guide/iwata-fukuroi-6checks/'),next:async()=>response,env:{ASSETS:{fetch:async()=>{fetched++;return new Response('<p>existing footer</p>')}}}});
 assert.equal(result,response);assert.equal(fetched,1);
 const rule=h.handlers.find(x=>x.selector==='link[rel="stylesheet"]');assert.ok(rule);
 for(const href of ['/assets/site-header.css?v=old','/assets/other.css?v=old']){
  const changed=[];rule.handler.element({getAttribute:n=>n==='href'?href:null,setAttribute:(n,v)=>changed.push([n,v])});
  assert.deepEqual(changed,href.includes('/site-header.css')?[['href','/assets/site-header.css?v=20261030-text200']]:[]);
 }
 let removed=0;h.handlers.find(x=>x.selector==='footer').handler.element({remove:()=>removed++});assert.equal(removed,1);
 let appended;h.handlers.find(x=>x.selector==='body').handler.element({append:(html,opts)=>appended={html,opts}});assert.equal(appended.html,'<footer class="fgo-global-footer-shell"><p>existing footer</p></footer>');assert.equal(appended.opts.html,true);
});
test('POST application API and other non-HTML responses bypass rewriting and footer fetch',async()=>{
 const h=load();const response=new Response('{"ok":true}',{headers:{'content-type':'application/json'}});let count=0;
 const result=await h.route({request:new Request('https://fudosan.atawi.link/api/karte-apply',{method:'POST',body:'mock only'}),next:async()=>response,env:{ASSETS:{fetch:async()=>{count++;throw Error('must not run')}}}});
 assert.equal(result,response);assert.equal(await result.text(),'{"ok":true}');assert.equal(count,0);assert.equal(h.handlers.length,0);
});
test('partial assets and unavailable footer keep existing passthrough behavior',async()=>{
 for(const partial of [true,false]){
  const h=load();const response=new Response('original',{headers:{'content-type':'text/html'}});let count=0;
  const result=await h.route({request:new Request('https://fudosan.atawi.link/'+(partial?'partials/footer.html':'guide/iwata-fukuroi-6checks/')),next:async()=>response,env:{ASSETS:{fetch:async()=>{count++;return new Response('missing',{status:404})}}}});
  assert.equal(result,response);assert.equal(h.handlers.length,0);assert.equal(count,partial?0:1);
 }
});
