const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const source=readFileSync(path.join(__dirname,'../functions/api/iwakita-submission.js'),'utf8');
const handler=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const valid={kind:'new',name:'架空の検査用氏名',url:'https://example.com/',note:'隔離テスト',email:'',website:'',id:'12345678-1234-4123-8123-123456789abc'};
function req(data=valid,origin='https://iwakita.atawi.link',method='POST'){
 return new Request('https://fudosan.atawi.link/api/iwakita-submission',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(data)}:{})});
}
test('Iwakita intake isolates origin, validates four purposes, and uses its own idempotency key',async()=>{
 const {onRequest}=await handler,env={RESEND_API_KEY:'mock-no-network'};
 assert.equal((await onRequest({request:req(valid,'https://banban.atawi.link'),env})).status,403);
 assert.equal((await onRequest({request:req(valid,undefined,'OPTIONS'),env})).status,204);
 assert.equal((await onRequest({request:req({...valid,url:'javascript:alert(1)'}),env})).status,400);
 assert.equal((await onRequest({request:req({...valid,kind:'correction',note:''}),env})).status,400);
 assert.equal((await onRequest({request:req({...valid,website:'bot'}),env})).status,400);
 assert.equal((await onRequest({request:req(),env:{}})).status,503);
 const original=globalThis.fetch,sent=[];
 globalThis.fetch=async(url,options)=>{sent.push({url,headers:options.headers,body:JSON.parse(options.body)});return Response.json({id:'mock-provider-id'});};
 try{
  for(const kind of ['new','correction','removal','source']){
   const response=await onRequest({request:req({...valid,kind,...(kind==='removal'?{url:''}:{})}),env});
   assert.equal(response.status,200);assert.deepEqual(await response.json(),{reference:'IK-'+valid.id});
  }
  assert.equal(sent.length,4);
  for(const mail of sent){assert.equal(mail.url,'https://api.resend.com/emails');assert.deepEqual(mail.body.to,['fudosan@fujigaoka-service.co.jp']);assert.match(mail.body.from,/iwakita@atawi.link/);assert.match(mail.body.text,/ATAWI磐田北高校/);assert.doesNotMatch(mail.body.text,/磐田南/);assert.equal(mail.headers['Idempotency-Key'],'IK-'+valid.id);}
 }finally{globalThis.fetch=original;}
});
test('Iwakita intake never reports success when the delivery provider rejects a request',async()=>{
 const {onRequest}=await handler,original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:'isolated-mock'},{status:503});
 try{assert.equal((await onRequest({request:req(),env:{RESEND_API_KEY:'mock-only'}})).status,502);}finally{globalThis.fetch=original;}
});
