const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../karte/sample/index.html'), 'utf8');
const code = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].find(m => m[2].includes('function activateSample'))[2];

function setup(situation = '') {
  let focused = '', saves = 0;
  const tabs = ['a','b','c'].map(id => ({id, tabIndex:0, attrs:{'data-sample':id}, events:{},
    getAttribute(k){return this.attrs[k];}, setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,fn){this.events[k]=fn;}, focus(){focused=id;}}));
  const panels = ['a','b','c'].map(id => ({id:'sample-'+id,hidden:false}));
  const context = {document:{querySelectorAll: s=>s==='[data-sample]'?tabs:panels,getElementById:()=>({textContent:''})},
    window:{karteContext:{read:()=>situation,sampleFor:s=>({care:'a',inheritance:'b',vacant:'c'}[s]||''),save:()=>saves++}}};
  vm.runInNewContext(code,context);
  function press(id,key){let prevented=false;tabs.find(t=>t.id===id).events.keydown({key,preventDefault(){prevented=true;}});return prevented;}
  return {tabs,panels,press,focused:()=>focused,saves:()=>saves};
}
test('sample tabs support arrow wrap, Home and End with one tab stop and the correct panel',()=>{
  const s=setup();
  assert.equal(s.press('a','ArrowRight'),true); assert.equal(s.focused(),'b');
  assert.deepEqual(s.tabs.map(t=>t.tabIndex),[-1,0,-1]);
  assert.deepEqual(s.panels.map(p=>p.hidden),[true,false,true]);
  s.press('b','End');assert.equal(s.focused(),'c');s.press('c','ArrowRight');assert.equal(s.focused(),'a');
  s.press('a','ArrowLeft');assert.equal(s.focused(),'c');s.press('c','Home');assert.equal(s.focused(),'a');
  assert.equal(s.press('a','Tab'),false);
});
test('changing the viewed sample never overwrites the applicant situation',()=>{
  const s=setup('inheritance');assert.equal(s.tabs[1].tabIndex,0);
  s.tabs[2].events.click();s.press('c','Home');assert.equal(s.saves(),0);
});
