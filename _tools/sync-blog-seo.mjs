// ブログ記事のSEO・計測タグ・sitemap登録を同期する保守スクリプト。
// 新しい記事を blog/YYYYMMDD-slug/ に追加したあと、リポジトリ直下で
//   node _tools/sync-blog-seo.mjs
// を実行すると、以下を冪等に整える（既に整っている記事は変更しない）。
//   1. sitemap.xml への記事URL登録と /blog/ の lastmod 更新
//   2. tracker.js / ai-referral.js の計測タグ
//   3. BlogPosting + BreadcrumbList の構造化データ（JSON-LD）
//   4. og:site_name / article:published_time / twitter:card メタ
//   5. blog/index.html の Blog 構造化データ
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteOrigin = 'https://fudosan.atawi.link';

const AI_REFERRAL = '<script defer src="/assets/ai-referral.js?v=20260723"></script>';
const TRACKER =
  '<script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script>';

const PUBLISHER = {
  '@type': 'Organization',
  name: '富士ヶ丘サービス株式会社',
  alternateName: 'ATAWI FUDOSAN',
  url: `${siteOrigin}/`,
  logo: { '@type': 'ImageObject', url: `${siteOrigin}/karte/assets/img/logo.jpg` },
};
const AUTHOR = {
  '@type': 'Person',
  name: '大石浩之',
  jobTitle: '代表取締役・宅地建物取引士',
  url: 'https://oishi-hiroyuki.org/',
};

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), value.replace(/\r?\n/g, '\n'), 'utf8');
}

function metaContent(source, pattern) {
  const match = source.match(pattern);
  return match ? match[1] : null;
}

const blogDirs = fs
  .readdirSync(path.join(root, 'blog'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{8}-/.test(entry.name))
  .filter((entry) => fs.existsSync(path.join(root, 'blog', entry.name, 'index.html')))
  .map((entry) => entry.name)
  .sort();

const changed = [];

for (const dir of blogDirs) {
  const relativePath = `blog/${dir}/index.html`;
  let source = read(relativePath);
  const original = source;

  const isoDate = `${dir.slice(0, 4)}-${dir.slice(4, 6)}-${dir.slice(6, 8)}`;
  const url = `${siteOrigin}/blog/${dir}/`;
  const title =
    metaContent(source, /<meta property="og:title" content="([^"]*)"/) ??
    metaContent(source, /<title>([^<]*)<\/title>/);
  const description =
    metaContent(source, /<meta name="description" content="([^"]*)"/) ?? '';
  const image = metaContent(source, /<meta property="og:image" content="([^"]*)"/);

  // 2. 計測タグ（</body> 直前、ai-referral → tracker の順）
  if (!source.includes('tracker.js')) {
    const scripts = source.includes('/assets/ai-referral.js')
      ? TRACKER
      : `${AI_REFERRAL}\n${TRACKER}`;
    source = source.replace('</body>', `${scripts}\n</body>`);
  } else if (!source.includes('/assets/ai-referral.js')) {
    source = source.replace(
      /(<script defer src="https:\/\/fujigaoka-analytics-worker[^>]*><\/script>)/,
      `${AI_REFERRAL}\n$1`,
    );
  }

  // 4. og:site_name / article:published_time / twitter:card
  const extraMeta = [];
  if (!source.includes('og:site_name')) {
    extraMeta.push('<meta property="og:site_name" content="ATAWI FUDOSAN">');
  }
  if (!source.includes('article:published_time')) {
    extraMeta.push(
      `<meta property="article:published_time" content="${isoDate}T09:00:00+09:00">`,
    );
  }
  if (!source.includes('twitter:card')) {
    extraMeta.push('<meta name="twitter:card" content="summary_large_image">');
  }
  if (extraMeta.length) {
    const anchor = source.match(/<meta property="og:url"[^>]*>/) ??
      source.match(/<link rel="canonical"[^>]*>/);
    if (anchor) source = source.replace(anchor[0], `${anchor[0]}\n${extraMeta.join('\n')}`);
  }

  // 3. BlogPosting + BreadcrumbList
  if (!source.includes('application/ld+json') && title) {
    const posting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      ...(image ? { image } : {}),
      datePublished: `${isoDate}T09:00:00+09:00`,
      dateModified: `${isoDate}T09:00:00+09:00`,
      inLanguage: 'ja',
      author: AUTHOR,
      publisher: PUBLISHER,
      isPartOf: { '@type': 'Blog', '@id': `${siteOrigin}/blog/#blog`, name: '大石の不動産ブログ' },
    };
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ATAWI FUDOSAN', item: `${siteOrigin}/` },
        { '@type': 'ListItem', position: 2, name: '大石の不動産ブログ', item: `${siteOrigin}/blog/` },
        { '@type': 'ListItem', position: 3, name: title, item: url },
      ],
    };
    const scripts = `<script type="application/ld+json">${JSON.stringify(posting)}</script>\n<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;
    source = source.replace('</head>', `${scripts}\n</head>`);
  }

  if (source !== original) {
    write(relativePath, source);
    changed.push(relativePath);
  }
}

// 5. blog/index.html の Blog 構造化データ
{
  const relativePath = 'blog/index.html';
  let source = read(relativePath);
  if (!source.includes('application/ld+json')) {
    const blog = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${siteOrigin}/blog/#blog`,
      url: `${siteOrigin}/blog/`,
      name: '大石の不動産ブログ',
      description:
        '磐田市・袋井市・森町の実家じまい・相続・空き家・売却の実務を、介護×不動産の視点でお届けするブログ。',
      inLanguage: 'ja',
      author: AUTHOR,
      publisher: PUBLISHER,
    };
    source = source.replace(
      '</head>',
      `<script type="application/ld+json">${JSON.stringify(blog)}</script>\n</head>`,
    );
    write(relativePath, source);
    changed.push(relativePath);
  }
}

// 1. sitemap.xml：未登録の記事URLを追記し、/blog/ の lastmod を最新記事日に更新
{
  let sitemap = read('sitemap.xml');
  const missing = blogDirs.filter(
    (dir) => !sitemap.includes(`<loc>${siteOrigin}/blog/${dir}/</loc>`),
  );
  if (missing.length) {
    const entries = missing
      .map((dir) => {
        const isoDate = `${dir.slice(0, 4)}-${dir.slice(4, 6)}-${dir.slice(6, 8)}`;
        return `  <url><loc>${siteOrigin}/blog/${dir}/</loc><lastmod>${isoDate}</lastmod></url>`;
      })
      .join('\n');
    const blogEntryPattern = /  <url><loc>https:\/\/fudosan\.atawi\.link\/blog\/\d{8}-[^<]*<\/loc><lastmod>[^<]*<\/lastmod><\/url>\n/g;
    const matches = [...sitemap.matchAll(blogEntryPattern)];
    if (matches.length) {
      const last = matches[matches.length - 1];
      const insertAt = last.index + last[0].length;
      sitemap = sitemap.slice(0, insertAt) + entries + '\n' + sitemap.slice(insertAt);
    } else {
      sitemap = sitemap.replace('</urlset>', `${entries}\n</urlset>`);
    }
  }
  const latest = blogDirs[blogDirs.length - 1];
  const latestDate = `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}`;
  sitemap = sitemap.replace(
    /(<url><loc>https:\/\/fudosan\.atawi\.link\/blog\/<\/loc><lastmod>)[^<]*(<\/lastmod>)/,
    `$1${latestDate}$2`,
  );
  if (sitemap !== read('sitemap.xml')) {
    write('sitemap.xml', sitemap);
    changed.push('sitemap.xml');
  }
  console.log(`sitemap: ${missing.length} 件のブログ記事URLを追加`);
}

console.log(`更新ファイル数: ${changed.length}`);
for (const file of changed) console.log(`  ${file}`);
