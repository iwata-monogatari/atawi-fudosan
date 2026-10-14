const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

for(const [file,name] of [['index.html','selectSituation'],['karte/index.html','setFormSituation']]){
 test('restoring a situation preserves optional disclosure choice: '+file,()=>{
  const html=read(file),start=html.indexOf('function '+name+'(');
  const code=html.slice(start,html.indexOf('\n}',start)+2);
  const nodes={};
  const get=id=>nodes[id]||(nodes[id]={value:'',hidden:true,open:false});
  const window={};vm.runInNewContext(read('assets/karte-context.js'),{window});
  const context={window,document:{getElementById:get,querySelectorAll:()=>[]},SITUATION_COPY:{vacant:{kicker:'空き家',title:'空き家',items:[],apply:'申込む'}},SITUATION_LABEL:{vacant:'空き家の管理'},trackEvent(){}};
  vm.createContext(context);vm.runInContext(code,context);
  get('optionalInfo').open=false;
  context[name]('vacant',true);
  assert.equal(get('optionalInfo').open,false);
  assert.equal(get('applySituationSummary').hidden,false);
  assert.match(get('applySituationSummary').textContent,/空き家の管理/);
  assert.equal(context.selectedSituation,'vacant');
  const pageshow=[];
  const helper={window:{addEventListener:(type,fn)=>{if(type==='pageshow')pageshow.push(fn);}},document:{querySelector:s=>s==='.consultation-form'?{id:'unifiedApply'}:null,getElementById:get}};
  get('formSituation').value='vacant';
  vm.runInNewContext(read('assets/consultation-form.js'),helper);
  pageshow.forEach(fn=>fn());
  assert.equal(get('optionalInfo').open,false,'shared script and pageshow must also preserve collapsed state');
  get('optionalInfo').open=true;
  context[name]('vacant',true);
  assert.equal(get('optionalInfo').open,true);
 });
 test('fee-first reading leads forward to the application without skipping blank inputs: '+file,()=>{
  const html=read(file),terms=html.indexOf('id="contact-flow"'),apply=html.indexOf('id="apply"'),city=html.indexOf('id="city"'),submit=html.indexOf('id="applyBtn"');
  assert.ok(terms<apply&&apply<city&&city<submit);
  assert.match(html.slice(terms,apply),/href="#apply">申込みへ進む/);
  assert.match(html.slice(apply,city),/href="\/karte\/line\/"/);
 });
}
test('LINE copying works or leaves a usable manual fallback without opening or sending a message',async()=>{
 for(const fail of [false,true]){
  let handler,copied='',focused=false,selected=false;
  const button={hidden:true,addEventListener:(_,fn)=>handler=fn},message={value:'実家カルテを希望します。\n物件の市町村：\n町名：',focus(){focused=true},select(){selected=true}},status={textContent:''};
  vm.runInNewContext(read('assets/karte-line.js'),{document:{getElementById:id=>({copyLineMessage:button,lineMessage:message,copyLineStatus:status})[id]},navigator:{clipboard:{writeText:async text=>{if(fail)throw Error('denied');copied=text;}}}});
  assert.equal(button.hidden,false);await handler();
  if(fail){assert.equal(focused&&selected,true);assert.match(status.textContent,/手動でコピー/);}
  else{assert.equal(copied,message.value);assert.match(status.textContent,/市町村・町名を記入して送信/);}
 }
});
