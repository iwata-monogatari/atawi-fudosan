// サイトマップは 2026-08-27 に3本へ分割した。
//   sitemap.xml        … <sitemapindex>（索引。<url> は入っていない）
//   sitemap-core.xml   … トップ・ハブ・カルテ・地域・診断などの本体ページ
//   sitemap-cases.xml  … /karte/cases/ の相談事例
//   sitemap-blog.xml   … ブログ記事と /blog/ ハブ（sync-blog-seo.mjs が追記）
//
// 分割の目的は、Search Console でどの群がインデックスされないかを切り分けること。
// URLを走査するツールは sitemap.xml ではなくこのモジュール経由で読むこと。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SITEMAP_PARTS = ['sitemap-core.xml', 'sitemap-cases.xml', 'sitemap-blog.xml'];

/** 3本ぶんのXMLを連結して返す。 */
export function readSitemapParts() {
  return SITEMAP_PARTS.map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
}

/** 索引が urlset に書き戻されていないかを見張る（seo-ai-upgrade.mjs のような旧スクリプト対策）。 */
export function assertIndexIntact() {
  const index = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  if (!index.includes('<sitemapindex')) {
    throw new Error(
      'sitemap.xml が索引ではなくなっています。3分割の構成が壊れました。' +
        'git diff sitemap.xml を確認してください。',
    );
  }
}
