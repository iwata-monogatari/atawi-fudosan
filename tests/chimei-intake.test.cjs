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
test('new regional and guide referrals preserve verified town names and a single accepted event',()=>{
  for(const [entry,code,name] of [['iwata-area_bottom','sagisaka_naka','匂坂中'],['ofuji_bottom','fujikambara','藤上原'],['mukasa_bottom','mukasa_takenouchi','向笠竹之内'],['ikago_bottom','ikago','五十子'],['ikkanji_bottom','ikkanji','壱貫地'],["tenryu_bottom", "tenryu", "天龍"],["tenryu_bottom", "toyoshima", "豊島"],["tenryu_bottom", "kamiokata", "上岡田"],["tahara_bottom", "tamakoshi", "玉越"],["tahara_bottom", "mikano", "三ケ野"],["tahara_bottom", "myogajima", "明ケ島"],["imanoura_bottom", "imanoura_1", "今之浦一丁目"],["imanoura_bottom", "imanoura_2", "今之浦二丁目"],["imanoura_bottom", "imanoura_3", "今之浦三丁目"],["imanoura_bottom", "imanoura_4", "今之浦四丁目"],["imanoura_bottom", "imanoura_5", "今之浦五丁目"],["hiramatsu-kakeshita-irisaku_bottom", "hiramatsu_kakeshita_irisaku", "平松掛下入作"],["oidaira_bottom", "oidaira", "大平"],['fukude_bottom','fukude','福田'],['toyooka_bottom','shimonobe','下野部'],['missing-aza_bottom','toyohama_nakano','豊浜中野'],['similar-names_bottom','matsunokijima','松之木島']]){
    const s=run('?chimei='+entry+'&chimei_town='+code);
    assert.equal(s.town.value,name);
    s.window.chimeiIntake.accepted({ok:false});
    assert.equal(s.events.filter(x=>x.endsWith('_accepted')).length,0);
    s.window.chimeiIntake.accepted({ok:true});s.window.chimeiIntake.accepted({ok:true});
    assert.equal(s.events.filter(x=>x.endsWith('_accepted')).length,1);
    assert.ok(s.events.includes('iwata_chimei_'+entry.replace(/-/g,'_')+'_accepted'));
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
