const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/chimei-intake.js','utf8');
function run(query, value='', city='磐田市') {
  const events=[], listeners={};
  const town={value,insertAdjacentElement(_,note){this.note=note.textContent;}};
  const nodes={city:{value:city},town,unifiedApply:{addEventListener(type,fn){listeners[type]=fn;}}};
  const window={fgaMeasurement:{track(name){events.push(name);}}};
  vm.runInNewContext(source,{URLSearchParams,location:{search:query},window,document:{readyState:'complete',getElementById(id){return nodes[id];},createElement(){return {};}}});
  return {window,town,events,listeners};
}
test('fixed public town codes prefill only Iwata and never overwrite user input',()=>{
  let s=run('?chimei=m149_bottom&chimei_town=mitsuke');
  assert.equal(s.town.value,'見付');assert.match(s.town.note,/修正/);
  assert.equal(run('?chimei=hub_bottom&chimei_town=toyoda_nishinoshima').town.value,'豊田西之島');
  assert.equal(run('?chimei=hub_bottom&chimei_town=nishinoshima').town.value,'西之島');
  assert.equal(run('?chimei=hub_bottom&chimei_town=mitsuke','編集中').town.value,'編集中');
  assert.equal(run('?chimei=hub_bottom&chimei_town=mitsuke','','袋井市').town.value,'');
});
test('unrecognized attribution and arbitrary address parameters cannot set town or emit events',()=>{
  for(const query of ['?chimei=private_person&chimei_town=mitsuke','?chimei=hub_bottom&chimei_town=__proto__','?chimei=hub_bottom&chimei_town=secret@example.com']){
    const s=run(query);assert.equal(s.town.value,'');assert.ok(!JSON.stringify(s.events).includes('secret'));
  }
});
test('only successful API result counts accepted; reload and empty/error results do not',()=>{
  const s=run('?chimei=hub_bottom&chimei_town=mitsuke');
  assert.deepEqual(s.events,['iwata_chimei_hub_bottom_landing']);
  s.window.chimeiIntake.accepted(undefined);s.window.chimeiIntake.accepted({ok:false});
  assert.equal(s.events.length,1);
  s.listeners.input();s.listeners.input();
  s.window.chimeiIntake.accepted({ok:true});s.window.chimeiIntake.accepted({ok:true});
  assert.deepEqual(s.events,['iwata_chimei_hub_bottom_landing','iwata_chimei_hub_bottom_form_start','iwata_chimei_hub_bottom_accepted']);
  assert.deepEqual(run('?chimei=hub_bottom').events,['iwata_chimei_hub_bottom_landing']);
  const html=fs.readFileSync('karte/index.html','utf8');
  assert.ok(html.indexOf('window.chimeiIntake.accepted(intakeResult)')>html.indexOf('await window.karteRequest.send'));
  assert.ok(!fs.readFileSync('karte/thanks/index.html','utf8').includes('chimei-intake'));
});
