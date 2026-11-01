const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const core = import('../assets/property-address-core.mjs');

test('full addresses accept common Japanese lot notation and reject missing/unknown details', async () => {
  const {addressValid, detailValid} = await core;
  const browser = {window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/property-address.js'),'utf8'), browser);
  for (const value of ['磐田市見付5789番地1', '磐田市 見付 ５７８９－１', '〒438-0086 静岡県磐田市見付5789-1', '森町 森 甲123番地', '浜松市中央区住吉一丁目二番三号', '袋井市高尾123番地の4', '磐田市見付123-4 サンプル101号', '森町森無番地']) {
    assert.equal(addressValid(value),true,value);
    assert.equal(browser.window.karteAddress.addressValid(value),true,value);
  }
  for (const value of ['', '   ', '磐田市', '磐田市 見付', '磐田市 見付 不明', '磐田市見付○○番地', '磐田市見付1丁目', '浜松市中央区住吉一丁目', '磐田市見付1丁目 サンプル101号', '磐田市見付123-', '見付123', 123, {}]) {
    assert.equal(addressValid(value),false,String(value));
    assert.equal(browser.window.karteAddress.addressValid(value),false,String(value));
  }
  for (const value of ['', '　', '不明', '未定', 'わかりません', '1丁目', '一丁目', '見付', '○○']) assert.equal(detailValid(value),false,value);
});

test('both real API handlers reject incomplete addresses before any notification; valid lot reaches the original recipient', async () => {
  const original=global.fetch; const sent=[];
  global.fetch=async (url,init)=>{sent.push({url,body:JSON.parse(init.body)});return new Response('{}');};
  const log=console.log; console.log=()=>{};
  try {
    for (const name of ['karte-apply','rent-inquiry']) {
      const {onRequestPost}=await import('../functions/api/'+name+'.js');
      const submit=addr=>onRequestPost({request:new Request('https://example.test/',{method:'POST',body:JSON.stringify({addr,mail:'test@example.test',name:'TEST',kind:'貸したい（オーナーとして相談）'})}),env:{RESEND_API_KEY:'TEST'}});
      const before=sent.length;
      for (const value of ['', '  ', '磐田市見付', '磐田市見付不明', '磐田市見付1丁目']) {
        const res=await submit(value);assert.equal(res.status,400);assert.equal((await res.json()).ok,false);
      }
      assert.equal(sent.length,before);
      assert.equal((await submit('磐田市見付123番地4')).status,200);
      assert.equal(sent.length,before+1);assert.equal(sent.at(-1).url,'https://api.resend.com/emails');
      assert.deepEqual(sent.at(-1).body.to,['fudosan@fujigaoka-service.co.jp']);
      assert.ok(sent.at(-1).body.text.includes('磐田市見付123番地4'));
    }
    const {onRequestPost}=await import('../functions/api/karte-apply.js');
    for (const addr of ['', '磐田市見付']) {
      const form=new FormData();form.set('source','top/tax-notice-photo');form.set('mail','test@example.test');form.set('addr',addr);
      const before=sent.length;const res=await onRequestPost({request:new Request('https://example.test/',{method:'POST',body:form}),env:{RESEND_API_KEY:'TEST'}});
      assert.equal(res.status,400);assert.equal(sent.length,before);
    }
  } finally {global.fetch=original;console.log=log;}
});

test('every property application form exposes a required address outside optional disclosures', async () => {
  const {propertyAddressHelp} = await import('../_tools/property-address-help.mjs');
  const routes=['index.html','karte/index.html','from-temple/index.html','from-shrine/index.html','kaigo-jikka/index.html','rent/index.html',...JSON.parse(fs.readFileSync(path.join(root,'lp/content.json'))).map(p=>'lp/'+p.slug+'/index.html')];
  for (const file of routes) {
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.ok(html.includes(propertyAddressHelp), `${file}: shared document guidance is missing`);
    assert.match(html,/src="\/assets\/property-address.js\?v=20261101"/,file);
    const field=html.match(/<input[^>]+id="(?:addressDetail|lpAddressDetail|addr)"[^>]*>/g).find(s=>!s.includes('type="hidden"'));
    assert.match(field,/\brequired\b/,file);
    if (html.includes('id="addressDetail"')) assert.ok(html.indexOf('id="addressDetail"')<html.indexOf('id="optionalInfo"'),file);
  }
});

test('referral and rental handlers stop town-only addresses in the browser',async()=>{
 for(const [file,name] of [['from-temple/index.html','submitKarteFromTemple'],['from-shrine/index.html','submitKarteFromShrine'],['kaigo-jikka/index.html','submitKarte'],['rent/index.html','submitRent']]){
  const html=fs.readFileSync(path.join(root,file),'utf8');const start=html.indexOf('async function '+name+'(');const code=html.slice(start,html.indexOf('\n}',start)+2);
  for(const value of ['', '　', '磐田市見付', '磐田市見付不明', '磐田市見付1丁目']){
   const fields={};let message='',focused=false,requests=0;
   const ctx={window:{},document:{getElementById:id=>fields[id]||=(id==='addr'?{value,focus(){focused=true}}:{value:'',disabled:false,style:{}})},alert:s=>message=s,fetch:async()=>{requests++;throw Error('unexpected request')},trackEvent(){},markFormStart(){},markKarteFormStart(){}};
   vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'assets/property-address.js'),'utf8'),ctx);vm.runInContext(code,ctx);await ctx[name]();
   assert.match(message,/番地・地番/,file);assert.equal(focused,true);assert.equal(requests,0);
  }
 }
});
