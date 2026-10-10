// リンクの順番ではなく、実際の到達先に合わせた案内名を使う。
const titles = new Map([
  ['/karte/', 'ふじがおか実家カルテ'],
  ['/karte/sample/', '実家カルテの見本を見る'],
  ['/karte/checklist/', '住所で分かること'],
  ['/karte/cases/', '実家・空き家の相談事例'],
  ['/jikka/', '実家じまい・空き家相談の総合案内'],
  ['/souzoku/', '相続した家・土地の相談案内'],
  ['/areas/', '対応地域と相談先'],
  ['/faq/', '実家カルテのよくある質問'],
  ['/privacy/', 'プライバシーポリシー'],
  ['/results/', '公開実績と運営者情報'],
  ['/shindan/', '実家の状況を整理する無料診断'],
]);

const legacyTitles = new Set(['ふじがおか実家カルテ', '住所で分かること', '関連する実家相談ページ', '関連ページ']);

export function relatedLinkTitle(url, fallback = '') {
  if (fallback && !legacyTitles.has(fallback)) return fallback;
  return titles.get(url) || fallback || '関連ページ';
}

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderRelatedLinks(links = []) {
  return links.map((link) => `<li><a href="${esc(link.url)}">${esc(relatedLinkTitle(link.url, link.title))}</a></li>`).join('');
}

// 本文を再生成せず、既存HTMLの関連リンクだけを同じ生成関数で更新する。
export function refreshRelatedLinks(html, links) {
  const pattern = /(<nav class="related"[^>]*><h2>次に読むページ<\/h2><ul>)[\s\S]*?(<\/ul><\/nav>)/g;
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) throw new Error('関連リンク欄が1件ではありません。変更せず確認してください。');
  const existingUrls = [...matches[0][0].matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  if (JSON.stringify(existingUrls) !== JSON.stringify(links.map((link) => esc(link.url)))) {
    throw new Error('既存HTMLとデータのリンク先が一致しません。変更せず確認してください。');
  }
  return html.replace(pattern, (_match, start, end) => start + renderRelatedLinks(links) + end);
}
