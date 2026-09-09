// Google 広告のコンバージョン計測タグ（gtag.js / AW-18409604033）を全公開HTMLの
// </head> 直前に冪等に挿入する保守スクリプト。リポジトリ直下で
//   node _tools/add-gtag.mjs
// を実行する。既にタグがあるファイルは変更しない。
// ページ生成スクリプト側にもタグを入れてあるが、生成物以外の手書きページや
// 新しく増えたページを取りこぼさないよう、公開前にこれを流す。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GTAG, GTAG_ID } from './gtag-snippet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 公開ページ以外は触らない
const SKIP_DIRS = new Set([
  'partials', '_tools', 'blog-auto', '.git', '.claude', 'node_modules', 'functions',
]);
// サイトの記事ではないHTML（外部サイトの保存物・テンプレート・生成サンプル）
const SKIP_FILES = new Set([
  'tools/flyer/template.html',
  'assets/visuals/pictograms/example.generated.html',
  // 調査用に保存した外部サイトのHTML（自社ページではないので計測対象外）
  'ath_buy22.html',
  'ath_iwata.html',
  'ath_rent22.html',
  'iw_plan.html',
  'iw_renkei.html',
  'iwata_bank.html',
  'iwata_list.html',
  'lifull_iwata.html',
  'soumu_raw.html',
  'soumu_utf8.html',
  'sz_r5.html',
  'tokuyou_page.html',
].map((p) => path.join(...p.split('/'))));

let modified = 0;
let skippedExisting = 0;
let skippedFile = 0;
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
    if (SKIP_FILES.has(rel)) { skippedFile++; continue; }
    let src = fs.readFileSync(full, 'utf8');
    if (src.includes(GTAG_ID) || src.includes('googletagmanager.com/gtag/js')) {
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
    console.log(`  + ${rel.split(path.sep).join('/')}`);
  }
}

walk(root);
console.log(`挿入: ${modified} 件 / 既設のためスキップ: ${skippedExisting} 件 / 対象外ファイル: ${skippedFile} 件 / headなし: ${noHead} 件`);
