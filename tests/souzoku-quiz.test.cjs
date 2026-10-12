const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {validateQuizState} = require('../souzoku-quiz/state.js');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const context={}; vm.createContext(context);
vm.runInContext(read('souzoku-quiz/content.js')+'\nglobalThis.sequence=questionsFor;',context);
test('each property has six questions with shared lessons and appropriate property-specific questions',()=>{
  const house=context.sequence('house'), land=context.sequence('land');
  assert.equal(house.length,6); assert.equal(land.length,6);
  for(const index of [0,1,3,5]) assert.equal(house[index].id,land[index].id);
  for(const index of [2,4]) assert.notEqual(house[index].id,land[index].id);
  assert.equal(house[2].id,'house-demolition'); assert.equal(land[4].id,'land-use');
  for(const q of [...house,...land]) { assert.ok(q.correct>=0&&q.correct<q.options.length); assert.ok(q.explanation&&q.action); }
});
test('restores valid completed answers but rejects partial results, foreign choices and injected keys',()=>{
  const state={kind:'land',index:5,answers:[1,0,0,2,0,0],concern:null,view:'result',started:true,completed:true};
  assert.deepEqual(validateQuizState(state),state);
  for(const changed of [{kind:'apartment'},{index:6},{answers:[1]},{answers:[9,0,0,2,0,0]},{concern:'<script>'},{extra:'private'},{view:'fake'}]) assert.equal(validateQuizState({...state,...changed}),null);
  assert.equal(validateQuizState(null),null);
});
test('publication entry points, canonical, sitemap and optional cross-site link stay connected',()=>{
  for(const file of ['index.html','souzoku/index.html']) assert.ok(read(file).includes('href="/souzoku-quiz/"'));
  assert.ok(read('sitemap-core.xml').includes('<loc>https://fudosan.atawi.link/souzoku-quiz/</loc>'));
  const html=read('souzoku-quiz/index.html'),js=read('souzoku-quiz/quiz.js');
  assert.ok(html.includes('rel="canonical" href="https://fudosan.atawi.link/souzoku-quiz/"'));
  assert.doesNotMatch(html,/noindex|掲載前の試作/);
  assert.ok(js.includes('https://baikyaku.atawi.link/?entry=souzoku-quiz#sale-check'));
  assert.ok(js.includes('https://fudosan.atawi.link/karte/'));
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|location\.(href|assign)\s*=/);
});
