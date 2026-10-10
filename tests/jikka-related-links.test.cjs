const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const load = () => import('../_tools/jikka-guide-related-links.mjs');

test('related labels follow destinations even when their order changes', async () => {
  const { renderRelatedLinks } = await load();
  const links = [{url:'/karte/cases/',title:'住所で分かること'}, {url:'/jikka/',title:'住所で分かること'}, {url:'/karte/checklist/',title:'関連する実家相談ページ'}];
  for (const order of [links, [...links].reverse()]) {
    const html = renderRelatedLinks(order);
    assert.ok(html.includes('href="/karte/cases/">実家・空き家の相談事例</a>'));
    assert.ok(html.includes('href="/jikka/">実家じまい・空き家相談の総合案内</a>'));
    assert.ok(html.includes('href="/karte/checklist/">住所で分かること</a>'));
    assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]), order.map(l=>l.url));
  }
});

test('scoped generation preserves surrounding HTML and refuses destination drift', async () => {
  const { refreshRelatedLinks } = await load();
  const before = '<article>本文を保持</article><nav class="related" aria-label="関連ページ"><h2>次に読むページ</h2><ul><li><a href="/karte/cases/">住所で分かること</a></li></ul></nav><script>keep()</script>';
  const result = refreshRelatedLinks(before, [{url:'/karte/cases/',title:'住所で分かること'}]);
  assert.equal(result, before.replace('>住所で分かること</a>', '>実家・空き家の相談事例</a>'));
  assert.equal(refreshRelatedLinks(result, [{url:'/karte/cases/'}]), result);
  assert.throws(()=>refreshRelatedLinks(before, [{url:'/jikka/'}]), /リンク先が一致しません/);
  assert.throws(()=>refreshRelatedLinks('<main>本文のみ</main>', []), /関連リンク欄が1件ではありません/);
});

test('specific editorial labels survive and are HTML escaped', async () => {
  const { renderRelatedLinks } = await load();
  assert.equal(renderRelatedLinks([{url:'/jikka/?a=1&b=2',title:'家族の「A<B」& 資料'}]), '<li><a href="/jikka/?a=1&amp;b=2">家族の「A&lt;B」&amp; 資料</a></li>');
});

test('all existing related sections match source destinations and generated names', async () => {
  const { refreshRelatedLinks } = await load();
  const data = JSON.parse(fs.readFileSync(path.join(root,'jikka-guide/data/complete-pages.json'),'utf8'));
  let checked = 0;
  for (const page of data.pages) {
    const html = fs.readFileSync(path.join(root,'jikka-guide',page.slug,'index.html'),'utf8');
    if (!html.includes('<nav class="related"')) continue;
    assert.equal(refreshRelatedLinks(html,page.relatedLinks),html,page.slug);
    for (const link of page.relatedLinks) {
      const pathname = link.url.split(/[?#]/)[0];
      const local = path.join(root,pathname.endsWith('/') ? pathname+'index.html' : pathname);
      assert.ok(fs.existsSync(local) || fs.existsSync(local+'.html'),link.url);
    }
    checked++;
  }
  assert.equal(checked,100);
});
