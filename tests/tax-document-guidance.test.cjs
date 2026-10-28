const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const parent = 'guide/parent-care-home-house/index.html';
const tool = '_tools/add-authority-content-20261012.py';
const oldRent = '貸すと空き家の3,000万円特別控除は使えなくなる';

test('tax document guidance distinguishes Iwata documents and applicants and preserves publication date', () => {
  const route = 'blog/20260720-koteishisanzei-tsuchisho-mikata/';
  const html = read(route+'index.html');
  assert.equal((html.match(/id="missing-tax-notice"/g)||[]).length, 1);
  for (const text of ['名寄帳兼課税台帳','評価証明書','納税証明書','通知書を再発行できるかも、市へ確認','同一世帯','相続関係','物件だけを指定した委任状','本人の住所登録地','本人の意思確認が難しい場合','1006295.html']) assert.ok(html.includes(text), text);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const article = blocks.find(x=>Array.isArray(x['@type']) && x['@type'].includes('BlogPosting'));
  assert.equal(article.datePublished, '2026-07-20T09:00:00+09:00');
  assert.ok(article.dateModified >= '2026-10-20');
  assert.ok(read('sitemap-blog.xml').includes(`<loc>https://fudosan.atawi.link/${route}</loc><lastmod>${article.dateModified}</lastmod>`));
  for (const text of ['親の土地を市役所で調べるには', 'href="#missing-tax-notice"', '市の課税資料と登記は別の情報', 'houmukyoku.moj.go.jp/homu/shomeisho_000001.html']) assert.ok(html.includes(text), text);
  const souzoku = read('souzoku/index.html');
  for (const text of ['/areas/fukuroi/koteishisanzei/', 'city.fukuroi.shizuoka.jp/soshiki/7/2/koteishisan/1422535327198.html', 'nta.go.jp/taxes/shiraberu/sodan/denwa-sodan/case2.htm']) assert.ok(souzoku.includes(text), text);
});

test('parent care table identifies inherited-house rules and links the existing owner-sale explanation', () => {
  const html = read(parent);
  assert.ok(!html.includes(oldRent));
  for (const text of ['相続した空き家の特例では、相続後の貸付け','相続した空き家の特例は、相続開始','親が存命中','href="/guide/senior-relocation/"','3302.htm','3306.htm','確定申告']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/data-parent-sale-tax=/g)||[]).length, 1);
  assert.ok(html.includes('"datePublished":"2026-07-23"'));
  const date = html.match(/"dateModified":"([^"]+)"/)[1];
  assert.ok(read('sitemap-core.xml').includes(`<loc>https://fudosan.atawi.link/guide/parent-care-home-house/</loc><lastmod>${date}</lastmod>`));
});

test('scoped parent-care generation preserves other pages, is repeatable, and rejects unknown edits', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parent-tax-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const write = (file,content) => {const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);};
  write(tool,read(tool));
  const published = read(parent);
  const oldRow = '<tr><th>税の期限</th><td>急いで現金化する必要がない</td><td>'+oldRent+'</td><td>相続開始の日から3年を経過する日の属する年の12月31日までの売却が要件。他の要件も確認</td></tr>';
  const legacy = published.replace(/<tr><th>税の期限・適用条件<\/th>[\s\S]*?<\/tr>/,oldRow).replace(/<p class="fine" data-parent-sale-tax="20261020">[\s\S]*?<\/p>/,'').replace('"dateModified":"2026-10-20"','"dateModified":"2026-10-13"');
  write(parent,legacy);
  write('guide/distant-family-home/index.html','UNRELATED EDIT');
  const run=()=>spawnSync('python',['-X','utf8',tool,'--parent-care-tax-only'],{cwd:dir,encoding:'utf8'});
  let result=run(); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/changed 1 files/);
  const first=fs.readFileSync(path.join(dir,parent),'utf8');
  assert.equal(first,published);
  result=run(); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/changed 0 files/);
  assert.equal(fs.readFileSync(path.join(dir,parent),'utf8'),first);
  assert.equal(fs.readFileSync(path.join(dir,'guide/distant-family-home/index.html'),'utf8'),'UNRELATED EDIT');
  const edited=legacy.replace(oldRent,'別担当による未確認の編集'); write(parent,edited);
  assert.notEqual(run().status,0);
  assert.equal(fs.readFileSync(path.join(dir,parent),'utf8'),edited);
  // Rebuilding the marked block from its original insertion anchor must use the same fixed text.
  const unmarked=published.replace(/<!-- authority-20261012 -->[\s\S]*?<\/article>/,'</article>');
  write(parent,unmarked); result=run(); assert.equal(result.status,0,result.stderr);
  const generated=fs.readFileSync(path.join(dir,parent),'utf8');
  assert.ok(!generated.includes(oldRent));
  assert.equal((generated.match(/data-parent-sale-tax=/g)||[]).length,1);
});


test('jikka parent care distinguishes owner sale and inherited-house tax rules', () => {
  const html = read('jikka/articles/after-care-facility.html');
  assert.ok(!html.includes(oldRent));
  for (const text of ['相続した空き家の特例では、相続後の貸付け', '親が存命中', '相続した空き家の特例は、相続開始', 'href="/guide/senior-relocation/"', '3302.htm', '3306.htm', '確定申告']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/data-jikka-parent-tax=/g)||[]).length, 1);
  assert.ok(html.includes('"datePublished":"2026-07-08"'));
  assert.ok(html.includes('"dateModified":"2026-10-28"'));
  assert.ok(read('sitemap-core.xml').includes('<loc>https://fudosan.atawi.link/jikka/articles/after-care-facility</loc><lastmod>2026-10-28</lastmod>'));
});

test('scoped jikka generation is repeatable, rejects unexpected edits, and preserves unrelated pages', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(), 'jikka-parent-tax-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const write=(p,v)=>{const dest=path.join(dir,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,v)};
  const article='jikka/articles/after-care-facility.html';
  write(tool,read(tool));
  const published=read(article);
  const oldRow='<div><b>税の期限</b><span>残す：急いで現金化する必要がない<br>貸す：'+oldRent+'<br>売る：相続開始の日から3年を経過する日の属する年の12月31日までの売却が要件。他の要件も確認</span></div>';
  const legacy=published.replace(/<div><b>税の期限・適用条件<\/b><span>[\s\S]*?<\/span><\/div>/,oldRow).replace(/<p class="fine" data-jikka-parent-tax="20261028">[\s\S]*?<\/p>/,'').replace('"dateModified":"2026-10-28"','"dateModified":"2026-10-13"').replace('<time datetime="2026-10-28">2026年10月28日</time>','<time datetime="2026-10-13">2026年10月13日</time>');
  assert.ok(legacy.includes(oldRow)); write(article,legacy); write('jikka/articles/faraway-management.html','OTHER'); write(parent,'OTHER GUIDE');
  const run=()=>spawnSync('python',['-X','utf8',tool,'--jikka-parent-tax-only'],{cwd:dir,encoding:'utf8'});
  let r=run(); assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/changed 1 files/);assert.equal(fs.readFileSync(path.join(dir,article),'utf8'),published);
  r=run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/changed 0 files/);
  assert.equal(fs.readFileSync(path.join(dir,'jikka/articles/faraway-management.html'),'utf8'),'OTHER');assert.equal(fs.readFileSync(path.join(dir,parent),'utf8'),'OTHER GUIDE');
  const edited=legacy.replace(oldRent,'別担当による未確認の編集');write(article,edited);assert.notEqual(run().status,0);assert.equal(fs.readFileSync(path.join(dir,article),'utf8'),edited);
});
