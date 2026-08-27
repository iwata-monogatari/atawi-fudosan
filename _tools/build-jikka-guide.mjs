import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideRoot = path.join(root, 'jikka-guide');
const siteOrigin = 'https://fudosan.atawi.link';
const dataPath = process.env.JIKKA_GUIDE_DATA ? path.resolve(root, process.env.JIKKA_GUIDE_DATA) : null;
let dataset;
if (dataPath?.endsWith('.json')) dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
else if (dataPath) dataset = await import(`${pathToFileURL(dataPath).href}?v=${Date.now()}`);
else {
  const completed = path.join(guideRoot, 'data', 'complete-pages.json');
  dataset = fs.existsSync(completed)
    ? JSON.parse(fs.readFileSync(completed, 'utf8'))
    : await import(`${pathToFileURL(path.join(guideRoot, 'data', 'pages.mjs')).href}?v=${Date.now()}`);
}
const { pages, hub = {} } = dataset;

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const asArray = (value) => Array.isArray(value) ? value : [];

function assertPage(page) {
  const required = ['slug', 'title', 'description', 'lead', 'category', 'published', 'modified'];
  for (const key of required) if (!page[key]) throw new Error(`${page.slug || '(slugなし)'}: ${key} が必要です`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) throw new Error(`${page.slug}: slug が不正です`);
  if (asArray(page.pictograms).length !== 4) throw new Error(`${page.slug}: pictograms は4件必要です`);
  if (!page.hero?.src?.endsWith('.webp')) throw new Error(`${page.slug}: hero.src は .webp を指定してください`);
  if (asArray(page.sections).length < 6) throw new Error(`${page.slug}: sections は6件以上必要です`);
  if (asArray(page.sources).length < 1) throw new Error(`${page.slug}: 公式出典が必要です`);
  if (asArray(page.faqs).length < 2) throw new Error(`${page.slug}: FAQ は2件以上必要です`);
}

function header() {
  return `<header class="site-global-header"><div class="site-global-header__inner">
  <a class="site-global-header__brand" href="/"><img class="site-global-header__logo" src="/karte/assets/img/logo.jpg" alt="富士ヶ丘サービス株式会社" width="358" height="68"><span class="site-global-header__mark">ATAWI FUDOSAN</span><span class="site-global-header__company">富士ヶ丘サービス株式会社</span></a>
  <nav class="site-global-header__nav" aria-label="メイン"><a href="/#karte">実家カルテ</a><a href="/karte/sample/">見本</a><a href="/jikka-guide/">実家ガイド</a><a href="/areas/">対応地域</a><a href="/blog/">ブログ</a><a href="/karte/">申し込む</a></nav>
  </div></header>`;
}

function cta(label = '住所を送って、無料で整理する') {
  return `<aside class="guide-cta" aria-label="ふじがおか実家カルテのご案内">
  <p class="guide-cta__eyebrow">標準分0円｜売却営業なし</p><h2>実家の住所から、確認する順番を整理します</h2>
  <p>査定ではありません。売るか決める前に、名義・道路・土地・農地・災害などを宅地建物取引士が確認します。</p>
  <div class="guide-cta__actions"><a class="button button--primary" href="/karte/">${esc(label)}</a><a class="button button--line" href="https://line.me/R/ti/p/%40531nwfsc">LINEで相談する</a><a class="button button--quiet" href="tel:0538313308">0538-31-3308</a></div>
  <small>住所を送っても売却依頼にはなりません。追加費用が必要な場合は事前にご案内します。</small></aside>`;
}

function renderSection(section, index) {
  const paragraphs = asArray(section.paragraphs).map((p) => `<p>${esc(p)}</p>`).join('\n');
  const checklist = asArray(section.checklist).length
    ? `<ul class="check-list">${section.checklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const table = asArray(section.table?.rows).length
    ? `<div class="table-scroll"><table><caption>${esc(section.table.caption || section.heading)}</caption><thead><tr>${asArray(section.table.headers).map((x) => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  return `<section class="article-section" id="section-${index + 1}"><h2>${esc(section.heading)}</h2>${section.intro ? `<p class="section-lead">${esc(section.intro)}</p>` : ''}${paragraphs}${checklist}${table}</section>`;
}

function renderPage(page) {
  assertPage(page);
  const url = `${siteOrigin}/jikka-guide/${page.slug}/`;
  const hero = page.hero.src.startsWith('/') ? page.hero.src : `/jikka-guide/${page.slug}/${page.hero.src}`;
  const schemas = {
    '@context': 'https://schema.org', '@graph': [
      {'@type':'Article','@id':`${url}#article`,headline:page.title,description:page.description,url,image:hero.startsWith('http')?hero:`${siteOrigin}${hero}`,datePublished:`${page.published}T09:00:00+09:00`,dateModified:`${page.modified}T09:00:00+09:00`,inLanguage:'ja',author:{'@type':'Person',name:'大石浩之',jobTitle:'代表取締役・宅地建物取引士'},reviewedBy:{'@type':'Person',name:'大石 浩之',url:'https://oishi-hiroyuki.org/',image:`${siteOrigin}/jikka-guide/assets/reviewer-oishi.jpg`,jobTitle:'代表取締役・宅地建物取引士',worksFor:{'@type':'Organization',name:'富士ヶ丘サービス株式会社'}},publisher:{'@type':'Organization',name:'富士ヶ丘サービス株式会社',url:`${siteOrigin}/`}},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'ATAWI FUDOSAN',item:`${siteOrigin}/`},{'@type':'ListItem',position:2,name:'実家ガイド',item:`${siteOrigin}/jikka-guide/`},{'@type':'ListItem',position:3,name:page.title,item:url}]},
      {'@type':'FAQPage',mainEntity:page.faqs.map((x)=>({'@type':'Question',name:x.question,acceptedAnswer:{'@type':'Answer',text:x.answer}}))}
    ]
  };
  const pictograms = page.pictograms.map((item) => {
    const src = item.src.startsWith('/') ? item.src : `/jikka-guide/${page.slug}/${item.src}`;
    return `<figure class="pictogram-card"><img src="${esc(src)}" width="120" height="120" alt="${esc(item.alt)}" loading="lazy"><figcaption><strong>${esc(item.title)}</strong><span>${esc(item.body)}</span></figcaption></figure>`;
  }).join('');
  const sources = page.sources.map((source) => `<li><a href="${esc(source.url)}" rel="noopener">${esc(source.title)}</a>${source.publisher ? `（${esc(source.publisher)}）` : ''}${source.note ? `<span class="source-note">${esc(source.note)}</span>` : ''}<small>確認日：${esc(source.accessed)}</small></li>`).join('');
  const related = asArray(page.relatedLinks).map((link) => `<li><a href="${esc(link.url)}">${esc(link.title)}</a></li>`).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}｜ふじがおか実家カルテ</title><meta name="description" content="${esc(page.description)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="ATAWI FUDOSAN"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(hero.startsWith('http')?hero:`${siteOrigin}${hero}`)}"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/site-header.css?v=20260724-brand"><link rel="stylesheet" href="/jikka-guide/assets/guide.css?v=20260827"><script type="application/ld+json">${json(schemas)}</script></head><body>
${header()}<main><nav class="breadcrumb" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><a href="/jikka-guide/">実家ガイド</a><span>›</span><span>${esc(page.title)}</span></nav>
<article class="guide-article"><header class="article-hero"><p class="article-meta">${esc(page.category)}｜${esc(page.published)}</p><h1>${esc(page.title)}</h1><p class="article-lead">${esc(page.lead)}</p><img class="hero-image" src="${esc(hero)}" width="1200" height="675" alt="${esc(page.hero.alt)}" fetchpriority="high"></header>
<section class="answer-box"><p class="answer-box__label">まず結論</p><p>${esc(page.summary)}</p></section><aside class="reading-guide" aria-label="このページの使い方"><h2>このページの使い方</h2><p>「${esc(page.title)}」は、最初から一つの結論を選ぶための記事ではありません。まず「${esc(page.sections[0].heading)}」で現在地を確かめ、次に「${esc(page.sections[1].heading)}」と「${esc(page.sections[2].heading)}」で手元資料や現況を整理してください。途中の章は、確認できた項目だけを記録すれば構いません。</p><p>各章末の三項目は、確認方法、判断を止める境界、記録する行動を示しています。分からない項目には推測を書かず、担当者と再確認日を付けます。最後の「${esc(page.sections.at(-1).heading)}」まで進んだら、公式出典を開いて条件の更新日を確かめ、家族へ同じ記録を共有してください。</p></aside><section class="pictogram-grid" aria-label="この記事で確認する4つの要点">${pictograms}</section>
<nav class="toc" aria-label="目次"><strong>この記事の内容</strong><ol>${page.sections.map((x,i)=>`<li><a href="#section-${i+1}">${esc(x.heading)}</a></li>`).join('')}<li><a href="#faq">よくある質問</a></li><li><a href="#sources">公式出典</a></li></ol></nav>
${page.sections.map(renderSection).join('\n')}${page.scopeNote?`<aside class="scope-note"><h2>このガイドで扱う範囲</h2><p>${esc(page.scopeNote)}</p></aside>`:''}${cta(page.ctaLabel)}
<section class="page-specific-notes"><h2>このページ固有の確認メモ</h2><p>ここからは「${esc(page.title)}」で特に確認したい内容を、事実、避けたい判断、手元資料に分けて示します。すべてを一度に終える必要はありません。確認できた項目には日付と根拠を添え、分からない項目には担当者と再確認日を付けてください。家族が別々の時間に作業しても、同じ一覧へ戻れる状態を目指します。</p><div class="notes-grid"><div><h3>確認しておく事実</h3><p>この欄は、方針を決める前に共有したい事実です。家族の記憶だけで確定せず、通知書、契約書、公式ページ、撮影日が分かる写真など、確認に使った根拠を隣へ書きます。該当しない項目も削除せず「該当なし」とした理由を残すと、後から同じ調査を繰り返さずに済みます。</p><ul>${page.fieldNotes.keyPoints.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>避けたい判断</h3><p>この欄に当てはまる可能性があるときは、契約や処分をいったん止めます。一般例を対象の家へ当てはめたのか、資料で確かめたのかを区別し、不足情報を質問へ直してください。法務、税務、測量、建物、行政など別分野の判断が必要なら、回答できる相談先へ切り分けます。</p><ul>${page.fieldNotes.pitfalls.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>手元で探すもの</h3><p>見つけた資料には名称、発行年、原本の保管者を記します。古い資料も経緯を知る手掛かりになるため、最新版と違うだけで捨てないでください。見つからない場合は空欄にせず、再取得できるか、誰に所在を尋ねるか、いつ再確認するかを決めると次の相談準備になります。</p><ul>${page.fieldNotes.checklist.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></section>
<aside class="notes-handoff"><h2>家族へ共有するとき</h2><p>確認済みと保留を色分けし、更新した人と日付を末尾へ記してください。口頭で補足した内容も短く追記し、原本の保管場所と次の確認担当を添えます。同じ一覧を見ながら話せば、次の相談で経緯を説明し直す負担を減らせます。</p></aside>
<section id="faq" class="faq-section"><h2>よくある質問</h2>${page.faqs.map((x)=>`<details><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join('')}</section>
<section id="sources" class="sources"><h2>公式出典・確認先</h2><p>制度や受付条件は変わることがあります。最終判断の前に、リンク先の最新情報と担当窓口を確認してください。</p><ol>${sources}</ol></section>
${related ? `<nav class="related" aria-label="関連ページ"><h2>次に読むページ</h2><ul>${related}</ul></nav>` : ''}
<section class="author reviewer-card" aria-labelledby="reviewer-heading"><img class="reviewer-card__photo" src="/jikka-guide/assets/reviewer-oishi.jpg" width="1080" height="1080" alt="この記事を確認した大石浩之" loading="lazy"><div><h2 id="reviewer-heading">この記事の確認者</h2><p><strong><a href="https://oishi-hiroyuki.org/" rel="author noopener">大石 浩之</a></strong></p><p>富士ヶ丘サービス株式会社 代表取締役・宅地建物取引士（静岡県知事 第027186号）。静岡県磐田市見付を拠点に、磐田市・袋井市・森町・掛川市・浜松市の一部で、相続不動産・空き家・実家じまいの相談に対応。家族が次に確認する事項を、判断を急がず、地域の実務と公的情報を分けながら整理しています。</p></div></section></article></main><footer class="fgo-global-footer-shell"></footer>
<script defer src="/assets/ai-referral.js?v=20260723"></script><script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script></body></html>`;
}

function renderHub() {
  const cards = pages.map((page) => `<article class="guide-card"><p>${esc(page.category)}</p><h2><a href="/jikka-guide/${esc(page.slug)}/">${esc(page.title)}</a></h2><p>${esc(page.description)}</p><a class="text-link" href="/jikka-guide/${esc(page.slug)}/">確認する順番を読む →</a></article>`).join('');
  const title = hub.title || '実家の状況別ガイド';
  const description = hub.description || '実家じまい、相続、空き家管理で迷ったときに、確認する順番を状況別に整理するガイドです。';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}｜ふじがおか実家カルテ</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${siteOrigin}/jikka-guide/"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${siteOrigin}/jikka-guide/"><link rel="stylesheet" href="/assets/site-header.css?v=20260724-brand"><link rel="stylesheet" href="/jikka-guide/assets/guide.css?v=20260827"><script type="application/ld+json">${json({'@context':'https://schema.org','@type':'CollectionPage',name:title,description,url:`${siteOrigin}/jikka-guide/`,hasPart:pages.map((p)=>({'@type':'Article',name:p.title,url:`${siteOrigin}/jikka-guide/${p.slug}/`}))})}</script></head><body>${header()}<main><section class="hub-hero"><p>ふじがおか実家カルテ</p><h1>${esc(title)}</h1><p>${esc(description)}</p><a class="button button--primary" href="/karte/">住所から無料で整理する</a></section><section class="guide-grid" aria-label="実家ガイド一覧">${cards}</section>${cta()}</main><footer class="fgo-global-footer-shell"></footer></body></html>`;
}

fs.mkdirSync(guideRoot, { recursive: true });
fs.writeFileSync(path.join(guideRoot, 'index.html'), renderHub(), 'utf8');
for (const page of pages) {
  const out = path.join(guideRoot, page.slug);
  fs.mkdirSync(out, { recursive: true });
  if (!page.hero.src.startsWith('/') && page.hero.fallbackSrc) {
    const destination = path.join(out, page.hero.src);
    const fallback = path.join(root, page.hero.fallbackSrc.replace(/^\//, ''));
    if (!fs.existsSync(destination)) {
      if (!fs.existsSync(fallback)) throw new Error(`${page.slug}: hero fallback が見つかりません: ${page.hero.fallbackSrc}`);
      fs.copyFileSync(fallback, destination);
    }
  }
  fs.writeFileSync(path.join(out, 'index.html'), renderPage(page), 'utf8');
}
fs.writeFileSync(path.join(guideRoot, 'generated-pages.json'), `${JSON.stringify(pages.map((p)=>p.slug), null, 2)}\n`, 'utf8');
{
  const sitemapPath = path.join(root, 'sitemap-core.xml');
  const start = '  <!-- jikka-guide:generated:start -->';
  const end = '  <!-- jikka-guide:generated:end -->';
  const latest = pages.map((p)=>p.modified).sort().at(-1) || '2026-08-27';
  const entries = [
    `  <url><loc>${siteOrigin}/jikka-guide/</loc><lastmod>${latest}</lastmod></url>`,
    ...pages.map((p)=>`  <url><loc>${siteOrigin}/jikka-guide/${p.slug}/</loc><lastmod>${p.modified}</lastmod></url>`),
  ];
  const block = `${start}\n${entries.join('\n')}\n${end}`;
  let sitemap = fs.readFileSync(sitemapPath,'utf8');
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`);
  sitemap = pattern.test(sitemap) ? sitemap.replace(pattern,block) : sitemap.replace('</urlset>',`${block}\n</urlset>`);
  fs.writeFileSync(sitemapPath,sitemap.replace(/\r?\n/g,'\n'),'utf8');
}
console.log(`jikka-guide: ハブ1件、詳細${pages.length}件を生成し、sitemap-core.xmlを同期しました`);
