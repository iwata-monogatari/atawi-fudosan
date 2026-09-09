// Google 広告のコンバージョン計測タグ（gtag.js / AW-18409604033）の唯一の定義。
// 保守スクリプト（_tools/add-gtag.mjs）とページ生成スクリプト（tools/*.mjs）が
// ここを読み込む。タグIDやスニペットを変えるときはこのファイルだけを直す。
export const GTAG_ID = 'AW-18409604033';

export const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GTAG_ID}');
</script>`;
