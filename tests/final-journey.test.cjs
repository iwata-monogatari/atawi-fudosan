const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function transport(fetch){
 const timers=new Map();let id=0;
 const ctx={window:{},fetch,AbortController,setTimeout(fn){timers.set(++id,fn);return id},clearTimeout(id){timers.delete(id)}};
 vm.runInNewContext(read('assets/karte-request.js'),ctx);
 return {api:ctx.window.karteRequest,expire(){for(const fn of [...timers.values()])fn()},timers};
}
test('contact validation catches unusable entries while accepting fullwidth, separators and international numbers',()=>{
 const {api}=transport();
 for(const value of ['0538-31-3308','０５３８（３１）３３０８','090 1234 5678','+81 90 1234 5678'])assert.equal(api.phoneValid(value),true,value);
 for(const value of ['123','０９０１２３','abcdefghij','090123456789','+123','0538a313308'])assert.equal(api.phoneValid(value),false,value);
 assert.equal(api.normalizePhone('０５３８（３１）３３０８'),'0538313308');
 for(const value of ['test@example.com','name+family@example.co.jp'])assert.equal(api.emailValid(value),true);
 for(const value of ['test@example','@example.com','test @example.com'])assert.equal(api.emailValid(value),false);
});
test('response headers and JSON body are both covered by timeout; no automatic retry or false success',async()=>{
 for(const stage of ['headers','body']){
  let calls=0,signal;
  const h=transport((url,options)=>{calls++;signal=options.signal;return stage==='headers'?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>new Promise(()=>{})})});
  const pending=h.api.send('/api/karte-apply',{mail:'qa@example.com'});await Promise.resolve();h.expire();
  await assert.rejects(pending,/send_timeout/);assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(h.timers.size,0);
 }
});
test('only confirmed API success resolves; failed or malformed responses clear the deadline',async()=>{
 for(const outcome of ['success','error','malformed','network']){
  const h=transport(async()=>{
   if(outcome==='network')throw Error('network');
   return {ok:outcome!=='error',json:async()=>{
    if(outcome==='malformed')throw Error('bad json');
    return outcome==='error'?{ok:false,error:'invalid_mail'}:{ok:true};
   }};
  });
  const pending=h.api.send('/api/karte-apply',{});
  if(outcome==='success')assert.equal((await pending).ok,true);else await assert.rejects(pending);
  assert.equal(h.timers.size,0);
 }
});
for(const file of ['areas/index.html','areas/check/index.html','areas/iwata/index.html','areas/fukuroi/index.html','areas/mori/index.html','areas/kakegawa/index.html','areas/hamamatsu/index.html']){
 test('region first valid selection reveals result, and outside area stays outside: '+file,()=>{
  const scripts=[...read(file).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const script=scripts.find(s=>s.includes('const outside=area.value'));
  const area={value:'袋井市'},topic={value:'道路・接道'},result={className:'result js-result',innerHTML:'',textContent:''};let click;
  const box={querySelector:s=>({'.js-area':area,'.js-topic':topic,'.js-result':result,'.js-check':{addEventListener(_,fn){click=fn}}})[s]};
  vm.runInNewContext(script,{window:{},document:{querySelectorAll:()=>[box]}});
  click();assert.match(result.className,/\bshow\b/);assert.match(result.innerHTML,/この条件で申し込む/);assert.match(result.innerHTML,/topic=/);
  area.value='上記以外';click();assert.match(result.innerHTML,/対象外/);assert.match(result.innerHTML,/\/karte\/out-of-area\//);
  area.value='';click();assert.match(result.textContent,/市町と悩みを選んでください/);
 });
}

for(const [file,name] of [['from-temple/index.html','submitKarteFromTemple'],['from-shrine/index.html','submitKarteFromShrine'],['kaigo-jikka/index.html','submitKarte']]){
 test('referral form validates contact, preserves failure input, prevents repeat sends and handles success: '+file,async()=>{
  const html=read(file);for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!m[1].includes('ld+json'))new vm.Script(m[2]);}
  assert.match(html,/そろった日の翌々日まで/);assert.doesNotMatch(html,/追加実費が必要|当日、遅くとも翌営業日/);
  const start=html.indexOf('async function '+name+'(');const code=html.slice(start,html.indexOf('\n}',start)+2);
  const fields={};for(const [id,value] of Object.entries({addr:'磐田市 テスト町',mail:'qa@example.com',tel:'',name:'',rel:'所有者の家族',topic:'確認したい',follow:'メール',body:'',company:''}))fields[id]={value,focus(){}};
  fields.privacy={checked:true};fields.applyBtn={disabled:false};fields.applyMsg={style:{}};
  const ctx={window:{karteRequest:transport().api,localStorage:{setItem(){}}},document:{getElementById:id=>fields[id],querySelector:()=>null,referrer:''},location:{href:'https://example.com/'},KARTE_API:'/api/karte-apply',APPLY_BTN_LABEL:'申込む',markFormStart(){},markKarteFormStart(){},trackEvent(){},alert(){throw Error('unexpected alert')},Date};
  vm.createContext(ctx);vm.runInContext(code,ctx);let calls=0;ctx.window.karteRequest.send=async()=>{calls++;throw Error('send_failed')};
  fields.mail.value='qa@example';await ctx[name]();assert.equal(calls,0);
  fields.mail.value='qa@example.com';fields.tel.value='123';await ctx[name]();assert.equal(calls,0);
  fields.tel.value='０５３８−３１−３３０８';await ctx[name]();assert.equal(calls,1);assert.equal(fields.applyBtn.disabled,false);assert.equal(fields.mail.value,'qa@example.com');assert.match(fields.applyMsg.textContent,/入力内容は残っています/);
  ctx.window.karteRequest.send=async(_,payload)=>{calls++;assert.equal(payload.tel,'0538313308');return {ok:true}};
  await ctx[name]();assert.match(ctx.location.href,/\/karte\/thanks\//);await ctx[name]();assert.equal(calls,2);
 });
}
