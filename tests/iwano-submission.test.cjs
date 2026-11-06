const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const modulePromise=import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'../functions/api/iwano-submission.js')).toString('base64'));
const id='6b12de3e-17bd-4c32-bd53-8a1d674ab999';
const valid={id,kind:'new',name:'受付機能の自動検証',url:'https://example.com/profile',email:'',note:'',website:''};
const env={RESEND_API_KEY:'isolated-test-only'};
const request=(data=valid,origin='https://iwano.atawi.link')=>new Request('https://fudosan.atawi.link/api/iwano-submission',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
test('Iwano accepts validated requests with isolated sender and idempotency key',async()=>{
 const {onRequest}=await modulePromise;let delivery;
 const saved=global.fetch;
 global.fetch=async(url,options)=>{delivery={url,headers:options.headers,body:JSON.parse(options.body)};return Response.json({id:'mock-mail-id'})};
 try{
  const result=await onRequest({request:request(),env});
  assert.equal(result.status,200);assert.deepEqual(await result.json(),{reference:'IN-'+id});
  assert.equal(delivery.body.from,'ATAWI磐田農業高校 <iwano@atawi.link>');
  assert.deepEqual(delivery.body.to,['fudosan@fujigaoka-service.co.jp']);
  assert.equal(delivery.headers['Idempotency-Key'],'IN-'+id);
  assert.ok(delivery.body.text.includes('ATAWI磐田農業高校'));
  assert.equal((await onRequest({request:request({...valid,kind:'removal',url:''}),env})).status,200);
 }finally{global.fetch=saved}
});
test('Iwano rejects other origins, bad URLs, missing correction, and invalid input',async()=>{
 const {onRequest}=await modulePromise;
 assert.equal((await onRequest({request:request(valid,'https://banban.atawi.link'),env})).status,403);
 for(const data of [{...valid,url:'javascript:alert(1)'},{...valid,url:'https://name:password@example.com'},{...valid,kind:'correction',note:''},{...valid,website:'spam'},{...valid,name:'bad\r\nname'},{...valid,id:'bad'}])assert.equal((await onRequest({request:request(data),env})).status,400);
 assert.equal((await onRequest({request:request(),env:{}})).status,503);
});
test('Iwano does not claim success on upstream mail failure',async()=>{
 const {onRequest}=await modulePromise;const saved=global.fetch;
 global.fetch=async()=>Response.json({error:'mock'},{status:500});
 try{assert.equal((await onRequest({request:request(),env})).status,502)}finally{global.fetch=saved}
});
