const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const source=readFileSync(path.join(__dirname,'../functions/api/banban-submission.js'),'utf8');
const handler=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('Bannan migration accepts only the corrected and legacy school origins without sending mail',async()=>{
 const {onRequest}=await handler;
 for(const origin of ['https://bannan.atawi.link','https://banban.atawi.link']){
  const options=await onRequest({request:new Request('https://fudosan.atawi.link/api/banban-submission',{method:'OPTIONS',headers:{Origin:origin}}),env:{}});
  assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),origin);
  const invalid=await onRequest({request:new Request('https://fudosan.atawi.link/api/banban-submission',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),env:{}});
  assert.equal(invalid.status,400);assert.equal(invalid.headers.get('Access-Control-Allow-Origin'),origin);
 }
 for(const origin of ['https://example.org','https://bannan.atawi.link.example.org','null']){
  const response=await onRequest({request:new Request('https://fudosan.atawi.link/api/banban-submission',{method:'OPTIONS',headers:{Origin:origin}}),env:{}});
  assert.equal(response.status,403);
 }
});
