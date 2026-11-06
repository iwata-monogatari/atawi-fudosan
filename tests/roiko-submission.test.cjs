const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('Roiko mail origin, validation, isolated reference, delivery and outage',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../functions/api/roiko-submission.js'),'utf8');
 const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const origin='https://roiko.atawi.link';
 const make=(data,o=origin,method='POST')=>new Request('https://fudosan.atawi.link/api/roiko-submission',{method,headers:{Origin:o,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(data)}:{})});
 const id='6cd67f47-3c37-4582-9bf5-c3bc479f7122';
 const base={id,kind:'new',name:'isolated unit test',url:'https://example.com/',email:'',note:'',website:''};
 assert.equal((await onRequest({request:make(base,'https://banban.atawi.link'),env:{}})).status,403);
 const preflight=await onRequest({request:make(null,origin,'OPTIONS'),env:{}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await onRequest({request:make({...base,url:'javascript:alert(1)'}),env:{}})).status,400);
 assert.equal((await onRequest({request:make({...base,kind:'correction',note:''}),env:{}})).status,400);
 assert.equal((await onRequest({request:make(base),env:{}})).status,503);
 const oldFetch=global.fetch;
 let last;
 try{
  global.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');last={options,message:JSON.parse(options.body)};return Response.json({id:'mock-mail-only'});};
  for(const kind of ['new','correction','removal','source']){
   const r=await onRequest({request:make({...base,kind,note:'correction text',url:kind==='removal'?'':base.url}),env:{RESEND_API_KEY:'fake-test-only'}});
   assert.equal(r.status,200);assert.equal((await r.json()).reference,'RK-'+id);
   assert.equal(last.options.headers['Idempotency-Key'],'RK-'+id);
   assert.ok(last.message.subject.includes('袋井高校'));
   assert.deepEqual(last.message.to,['fudosan@fujigaoka-service.co.jp']);
   assert.ok(!last.message.text.includes('磐南'));
  }
  global.fetch=async()=>Response.json({error:'mock outage'},{status:503});
  assert.equal((await onRequest({request:make(base),env:{RESEND_API_KEY:'fake-test-only'}})).status,502);
 }finally{global.fetch=oldFetch;}
});
