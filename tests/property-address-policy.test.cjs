const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const policy = import('../_tools/check-property-address-policy.mjs');
const run = (args, cwd=root) => spawnSync(process.execPath, args, {cwd, encoding:'utf8'});

test('application copy distinguishes an unidentified property from a private preparation note', async () => {
  const {addressPolicyErrors} = await policy;
  for (const text of [
    '住所があいまいでも、通知書や写真から確認順を整理します。カルテ申込またはLINEで状況を送ってください。',
    '番地が曖昧でも分かる範囲でカルテ申込み',
    'フォームで市町・町名と連絡先を入力します。',
  ]) assert.ok(addressPolicyErrors(text, 'index.html').length, text);
  for (const text of [
    '住所があいまいでも、家族のメモには今分かることを書いておけます。',
    '番地が曖昧でも相談できますか？ 申込みには番地・地番と連絡先が必要です。',
  ]) assert.deepEqual(addressPolicyErrors(text, 'index.html'), []);
});

test('policy rejects the closed town-and-contact list while preserving complete address guidance', async () => {
  const {addressPolicyErrors} = await policy;
  const oldCopy = '必要なのは、物件の市町・町名と連絡先です。';
  for (const value of [oldCopy, '<p>必要なのは、物件の<strong>市町・町名</strong>と連絡先です。</p>', JSON.stringify({text: oldCopy})]) {
    assert.ok(addressPolicyErrors(value, 'jikka/articles/after-care-facility.html').length, value);
  }
  for (const value of [
    'ご相談の申込みには、物件の市町・町名に加えて番地・地番と、連絡先が必要です。番地・地番が分からない場合は、固定資産税の課税明細書や登記書類で確認してください。',
    '必要なのは、物件の市町・町名と番地・地番、連絡先です。',
    '家族用の非送信メモです。市町・町名を控え、申込時には番地・地番まで確認してください。',
    '市町・町名で地域の対応可否のみ確認します。申込みには番地・地番と連絡先が必要です。',
  ]) assert.deepEqual(addressPolicyErrors(value, 'index.html'), [], value);
});

test('policy rejects old copy, inline markup, JSON-LD, escaped text and optional address inputs', async () => {
  const {addressPolicyErrors} = await policy;
  for (const value of ['町名だけで大丈夫', '町名まででOK', '町名だけでも相談できます', '番地（任意）', '番地・地番の入力は任意', '地番が分からないままでも相談できます', '<b>町名だけ</b>で大丈夫', JSON.stringify({acceptedAnswer:{text:'町名だけで大丈夫'}}), '\\u753a名だけで大丈夫', '<input id="addressDetail">', '<details><input name="addr" required></details>']) {
    assert.ok(addressPolicyErrors(value, 'blog/new/index.html').length, value);
  }
  for (const value of ['番地・地番まで必須です。書類で確認してください。','家族用メモに詳しい住所は保存しません。申込時に番地・地番まで必要です。','地域の対応可否のみを確認するツールです。','<input id="addressDetail" required aria-required="true">']) assert.deepEqual(addressPolicyErrors(value, 'index.html'), []);
});

test('current public pages and generation sources satisfy the policy', async () => {
  const {checkSite}=await policy;
  assert.deepEqual(checkSite().errors, []);
});

test('CLI returns failure for a new blog with old copy', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'address-policy-'));
  try {
    const file=path.join(temp,'index.html');fs.writeFileSync(file,'<p>町名だけで大丈夫</p>');
    const result=run(['_tools/check-property-address-policy.mjs',file]);
    assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/番地必須/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('LP regeneration retains required fields and rejects legacy data before any write', async () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'address-lp-'));
  try {
    for(const file of ['tools/generate-consultation-lps.mjs','_tools/check-property-address-policy.mjs','_tools/property-address-help.mjs','lp/content.json','lp/updates.json','data/karte-service-policy.json','data/public-organization.json','sitemap-core.xml']) {
      const destination=path.join(temp,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination);
    }
    let result=run(['tools/generate-consultation-lps.mjs'],temp);assert.equal(result.status,0,result.stderr);
    const {addressPolicyErrors}=await policy;
    for (const p of JSON.parse(fs.readFileSync(path.join(temp,'lp/content.json')))) {
      const file=`lp/${p.slug}/index.html`,html=fs.readFileSync(path.join(temp,file),'utf8');
      assert.deepEqual(addressPolicyErrors(html,file),[]);assert.match(html,/<input[^>]+id="lpAddressDetail"[^>]* required/);
      assert.match(html,/property-address\.js/);
    }
    const hub=path.join(temp,'lp/index.html');const before=fs.readFileSync(hub,'utf8');
    const content=path.join(temp,'lp/content.json');fs.writeFileSync(content,fs.readFileSync(content,'utf8').replace('親','町名だけで大丈夫'));
    result=run(['tools/generate-consultation-lps.mjs'],temp);assert.notEqual(result.status,0);assert.match(result.stderr,/番地必須/);assert.equal(fs.readFileSync(hub,'utf8'),before);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
