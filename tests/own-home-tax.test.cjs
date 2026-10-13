const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
const slugs = ['before-selling-own-home', 'own-home-future', 'senior-relocation'];
const script = '_tools/add-authority-content-round2.py';
const read = p => fs.readFileSync(path.join(root,p), 'utf8');
const deadline = '住まなくなった日から3年を経過する日の属する年の12月31日まで';

function verify(html) {
  assert.doesNotMatch(html, /貸し始めると居住用財産の特例は使えなくなる|その間に貸すと対象外/);
  for (const text of [deadline, '退去後に貸したことだけで', '確定申告', '取り壊しから1年以内', '貸駐車場', '相続した空き家の特例は別制度', '3302.htm', '3306.htm', '税務署・税理士']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/<!-- authority-20261012 -->/g)||[]).length, 1);
}

test('own-home guides distinguish renting, demolition and inherited-house conditions with matching revision dates', () => {
  for (const slug of slugs) {
    const html = read(`guide/${slug}/index.html`);
    verify(html);
    assert.ok(html.includes('"datePublished":"2026-08-30"'));
    const date = html.match(/"dateModified":"([^"]+)"/)[1];
    const xml = read('sitemap-core.xml');
    const entry = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].filter(m=>m[1].includes(`<loc>https://fudosan.atawi.link/guide/${slug}/</loc>`));
    assert.equal(entry.length,1);
    assert.ok(entry[0][1].includes(`<lastmod>${date}</lastmod>`));
  }
});

test('existing marked HTML is corrected once; unrelated files and a second run are unchanged', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'own-tax-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const write = (p,s) => { fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true}); fs.writeFileSync(path.join(dir,p),s); };
  write(script,read(script));
  write('karte/assets/atawi.css','/* unchanged CSS */');
  write('guide/inherited-family-home/index.html','<!-- authority-20261012 -->相続記事は保持');
  write('areas/hamamatsu/index.html','窓口情報は保持');
  for (const slug of slugs) write(`guide/${slug}/index.html`,read('tests/fixtures/own-home-tax-20261012.txt'));
  const run = () => spawnSync('python',['-X','utf8',script,'--own-tax-only'],{cwd:dir,encoding:'utf8'});
  let result=run(); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/changed 3 files/);
  const first = slugs.map(s=>fs.readFileSync(path.join(dir,`guide/${s}/index.html`),'utf8'));
  first.forEach(html=>{verify(html);assert.ok(html.includes('既存本文を保持'));assert.ok(html.includes('後続本文を保持'));assert.ok(html.includes('"dateModified":"2026-10-13"'));});
  result=run(); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/changed 0 files/);
  slugs.forEach((s,i)=>assert.equal(fs.readFileSync(path.join(dir,`guide/${s}/index.html`),'utf8'),first[i]));
  assert.equal(fs.readFileSync(path.join(dir,'karte/assets/atawi.css'),'utf8'),'/* unchanged CSS */');
  assert.equal(fs.readFileSync(path.join(dir,'guide/inherited-family-home/index.html'),'utf8'),'<!-- authority-20261012 -->相続記事は保持');
  assert.equal(fs.readFileSync(path.join(dir,'areas/hamamatsu/index.html'),'utf8'),'窓口情報は保持');
  // Unknown edited wording must fail rather than overwrite another editor's text.
  write(`guide/${slugs[0]}/index.html`,first[0].replace('退去後に貸したことだけで居住用財産の特例の対象外にはならない。期限・他の要件を確認','別担当の未確認文'));
  assert.notEqual(run().status,0);
});
