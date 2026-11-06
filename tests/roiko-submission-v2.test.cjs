const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('anonymous directory submissions validate IDs without requiring or mailing a person name',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../functions/api/roiko-submission.js'),'utf8');
 const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const base={version:2,id:'6cd67f47-3c37-4582-9bf5-c3bc479f7122',kind:'removal',management_id:'RK-0001',url:'',note:'',email:'',website:''};
 const make=data=>new Request('https://fudosan.atawi.link/api/roiko-submission',{method:'POST',headers:{Origin:'https://roiko.atawi.link','Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await onRequest({request:make({...base,management_id:''}),env:{}})).status,400);
 assert.equal((await onRequest({request:make({...base,management_id:'invalid'}),env:{}})).status,400);
 assert.equal((await onRequest({request:make({...base,kind:'new'}),env:{}})).status,400);
 assert.equal((await onRequest({request:make({...base,kind:'source',url:'https://example.com/'}),env:{}})).status,400);
 let sent=0;const oldFetch=global.fetch;
 try{
  global.fetch=async(url,options)=>{sent++;const message=JSON.parse(options.body);assert.ok(message.text.includes('管理番号：RK-0001'));assert.ok(!message.text.includes('掲載名：'));return Response.json({id:'mock-only'});};
  for(const kind of ['removal','correction','new']){
   const result=await onRequest({request:make({...base,kind,note:'request',url:kind==='new'?'https://example.com/':''}),env:{RESEND_API_KEY:'fake-test-only'}});
   assert.equal(result.status,200);
  }
  assert.equal(sent,3);
 }finally{global.fetch=oldFetch;}
});
