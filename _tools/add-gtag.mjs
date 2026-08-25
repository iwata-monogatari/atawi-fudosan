// Google 広告のコンバージョン計測タグ（gtag.js / AW-18409604033）を全公開HTMLの
// </head> 直前に冪等に挿入する保守スクリプト。リポジトリ直下で
//   node _tools/add-gtag.mjs
// を実行する。既にタグがあるファイルは変更しない。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18409604033"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-18409604033');
</script>`;

// 公開ページ以外は触らない
const SKIP_DIRS = new Set(['partials', '_tools', 'blog-auto', '.git', 'node_modules', 'functions']);
const SKIP_FILES = new Set([path.join('tools', 'flyer', 'template.html')]);

let modified = 0;
let skippedExisting = 0;
let noHead = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.html')) continue;
    if (SKIP_FILES.has(rel)) continue;
    let src = fs.readFileSync(full, 'utf8');
    if (src.includes('AW-18409604033') || src.includes('googletagmanager.com/gtag/js')) {
      skippedExisting++;
      continue;
    }
    if (!src.includes('</head>')) {
      noHead++;
      continue;
    }
    src = src.replace('</head>', `${GTAG}\n</head>`);
    fs.writeFileSync(full, src);
    modified++;
  }
}

walk(root);
console.log(`挿入: ${modified} 件 / 既設のためスキップ: ${skippedExisting} 件 / headなし: ${noHead} 件`);
