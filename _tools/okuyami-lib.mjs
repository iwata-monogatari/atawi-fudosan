/* 磐田おくやみ窓口（/souzoku/okuyami/）の静的ページ生成スクリプト
 *
 *   node site/_tools/build-okuyami.mjs
 *
 * 窓口名・電話・持ち物・CTA文言などのデータは souzoku/okuyami/okuyami-data.json、
 * 国の手続き期限は souzoku/okuyami/national-deadlines.json だけを正本とする。
 * 年次更新はこの2つのJSONを差し替えて本スクリプトを再実行すれば完結する。
 *
 * ヘッダー・共通フッターは souzoku/articles/fixed-asset-tax-notice.html から
 * 実物を切り出して流用するため、既存ページと必ず同一になる。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'souzoku', 'okuyami');
const BASE = 'https://fudosan.atawi.link/souzoku/okuyami/';

const D = JSON.parse(readFileSync(join(DIR, 'okuyami-data.json'), 'utf8'));
const ND = JSON.parse(readFileSync(join(DIR, 'national-deadlines.json'), 'utf8'));
const CTA = D.funnel.cta_library;

/* ------------------------------------------------------------------ */
/* 共通部品                                                            */
/* ------------------------------------------------------------------ */

const donor = readFileSync(join(ROOT, 'souzoku', 'articles', 'fixed-asset-tax-notice.html'), 'utf8');

function slice(src, startMark, endMark, { includeEnd = true } = {}) {
  const s = src.indexOf(startMark);
  const e = src.indexOf(endMark, s);
  if (s < 0 || e < 0) throw new Error(`共通部品を切り出せません: ${startMark}`);
  return src.slice(s, includeEnd ? e + endMark.length : e);
}

const HEADER = slice(donor, '<header class="site-header">', '</header>');
const MANAGED_FOOTER = slice(donor, '<!-- managed-footer:start -->', '<!-- managed-footer:end -->');
const COMPANY_INFO = slice(donor, '<div class="fgo-company-info"', '</div>');
const STICKY_CTA = slice(donor, '<div class="sticky-cta"', '</div>');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const telDigits = (tel) => (String(tel || '').match(/0\d[\d-]{7,}/) || [null])[0]?.replace(/-/g, '') ?? null;

function telLink(tel) {
  if (!tel) return '';
  const d = telDigits(tel);
  return d
    ? `<a class="tel" href="tel:${d}" data-track="cta_tel_click" data-cta="madoguchi">${esc(tel)}</a>`
    : esc(tel);
}

function anchor(link, cls = '') {
  const ext = /^https?:/.test(link.url);
  return `<a${cls ? ` class="${cls}"` : ''} href="${esc(link.url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(link.label)}</a>`;
}

const win = (id) => D.windows.find((w) => w.id === id);
const bld = (id) => D.buildings.find((b) => b.id === id);
const q = (id) => D.questions.find((x) => x.id === id);
const ext = (id) => D.external_always_show.items.find((x) => x.id === id);

/* ------------------------------------------------------------------ */
/* ブロック生成                                                        */
/* ------------------------------------------------------------------ */

/** AIO/LLMO用のQ&Aブロック。カルテCTA①を兼ねる。 */
function aioBlock(question, answer) {
  return `<div class="aio-qa">
        <p class="q">Q. ${esc(question)}</p>
        <p class="a">${esc(answer)}</p>
        <p class="a" style="margin-top:10px"><a href="/karte/">富士ヶ丘サービスの売却前カルテについて見る</a></p>
      </div>`;
}

function faqJsonLd(pairs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });
}

function deadlineAlert(d) {
  return `<div class="deadline-alert">
          <h3>期限があります：${esc(d.label)}</h3>
          <p class="limit">${esc(d.limit)}</p>
          ${d.note ? `<p>${esc(d.note)}</p>` : ''}
        </div>`;
}

function strongCard() {
  const c = CTA.result_strong;
  return `<aside class="funnel-strong">
        <h4>${esc(c.heading)}</h4>
        <p>${esc(c.body)}</p>
        <div class="cta-actions">${c.links.map((l, i) => anchor(l, `btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`)).join('')}</div>
      </aside>`;
}

function footerCta() {
  const c = CTA.generic_footer;
  return `<section class="section section-soft">
    <div class="wrap narrow">
      <aside class="funnel-footer">
        <h3>${esc(c.heading)}</h3>
        <p>${esc(c.body)}</p>
        <div class="cta-actions">${c.links.map((l, i) => anchor(l, `btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`)).join('')}</div>
      </aside>
    </div>
  </section>`;
}

function sourceNote() {
  const s = D.meta.source;
  return `<section class="section" style="padding-top:0">
    <div class="wrap narrow">
      <p class="source-note">${esc(D.meta.disclaimer)}<br>
        <b>出典</b>：${esc(s.name)}（${esc(s.edition)}）<a href="${esc(s.page_url)}" target="_blank" rel="noopener">磐田市公式ページ</a>／
        <b>確認日</b>：${esc(s.confirmed_date)}（次回見直し予定 ${esc(s.next_review)}）
      </p>
    </div>
  </section>`;
}

/** 5建物の位置関係図（インラインSVG） */
function buildingMap() {
  const pos = {
    honcho1: { x: 44, y: 150, w: 120, h: 78, lines: ['市役所', '本庁舎1階'] },
    nishi1: { x: 176, y: 150, w: 116, h: 78, lines: ['市役所', '西庁舎1階'] },
    nishi2: { x: 176, y: 240, w: 116, h: 78, lines: ['市役所', '西庁舎2階'] },
    iplaza3: { x: 342, y: 150, w: 130, h: 78, lines: ['iプラザ', '3階'] },
    fukude2: { x: 518, y: 150, w: 162, h: 78, lines: ['福田支所', '2階'] },
  };
  const counts = Object.fromEntries(D.buildings.map((b) => [b.id, D.windows.filter((w) => w.building === b.id).length]));

  const cards = D.buildings.map((b, i) => {
    const p = pos[b.id];
    const color = ['#315d78', '#b78a45', '#5b7f95', '#5b7f95', '#b75f3a'][i] || '#315d78';
    const cx = p.x + p.w / 2;
    return `<g class="diagram-node">
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="10" fill="#fff" stroke="${color}" stroke-width="2"/>
      <text x="${cx}" y="${p.y + 28}" text-anchor="middle" fill="#24302f" font-size="14" font-weight="800">${esc(p.lines[0])}</text>
      <text x="${cx}" y="${p.y + 47}" text-anchor="middle" fill="#24302f" font-size="14" font-weight="800">${esc(p.lines[1])}</text>
      <text x="${cx}" y="${p.y + 66}" text-anchor="middle" fill="${color}" font-size="12" font-weight="700">窓口${counts[b.id]}か所</text>
    </g>`;
  }).join('\n      ');

  return `<figure class="building-map">
      <svg viewBox="0 0 720 384" role="img" aria-label="磐田市の手続き窓口がある5つの建物の位置関係" xmlns="http://www.w3.org/2000/svg">
        <rect width="720" height="384" rx="18" fill="#fffdf9"/>
        <rect x="18" y="18" width="684" height="348" rx="16" fill="#f3f7fa" stroke="#dedfd8"/>
        <rect x="34" y="34" width="652" height="52" rx="12" fill="#fff" opacity=".92"/>
        <text x="52" y="67" fill="#315d78" font-size="21" font-weight="800">手続きの窓口は5か所に分かれています</text>

        <rect x="30" y="106" width="276" height="232" rx="12" fill="#fff" opacity=".55" stroke="#315d78" stroke-dasharray="5 4"/>
        <text x="46" y="130" fill="#315d78" font-size="13" font-weight="800">磐田市役所（国府台3-1）</text>

        <rect x="326" y="106" width="164" height="232" rx="12" fill="#fff" opacity=".55" stroke="#b78a45" stroke-dasharray="5 4"/>
        <text x="342" y="130" fill="#b78a45" font-size="13" font-weight="800">iプラザ（国府台57-7）</text>

        <rect x="502" y="106" width="194" height="232" rx="12" fill="#fff" opacity=".55" stroke="#b75f3a" stroke-dasharray="5 4"/>
        <text x="518" y="130" fill="#b75f3a" font-size="13" font-weight="800">福田支所（福田400）</text>

        ${cards}

        <text x="46" y="360" fill="#5d6968" font-size="12">市役所（本庁舎・西庁舎）とiプラザは徒歩圏内。福田支所は離れた場所にあります。</text>
      </svg>
      <figcaption>市役所本庁舎1階・iプラザ3階・西庁舎1階・西庁舎2階・福田支所2階の5か所に窓口が分かれています。ただし、国民健康保険・介護保険・障害者手帳などの返納は各支所や市民課でも受け付けています。</figcaption>
    </figure>`;
}

/* ------------------------------------------------------------------ */
/* ページ雛形                                                          */
/* ------------------------------------------------------------------ */

function page({ file, title, description, eyebrow, h1, lead, body, breadcrumb, faq, extraScripts = '' }) {
  const url = BASE + (file === 'index.html' ? '' : file);
  const crumbs = [
    { name: 'トップ', item: 'https://fudosan.atawi.link/souzoku/' },
    { name: '磐田おくやみ窓口', item: BASE },
    ...(breadcrumb ? [{ name: breadcrumb, item: url }] : []),
  ];

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#315d78">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="https://fudosan.atawi.link/souzoku/og-image.png">
  <meta property="og:locale" content="ja_JP">
  <link rel="icon" href="../favicon.ico" sizes="any">
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="okuyami.css">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":["LocalBusiness","RealEstateAgent"],"name":"富士ヶ丘サービス株式会社","url":"https://fudosan.atawi.link/souzoku/","telephone":"0538-31-3308","email":"fudosan@fujigaoka-service.co.jp","areaServed":["磐田市","袋井市","掛川市","森町","浜松市の一部"]}</script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  })}</script>
  <script type="application/ld+json">${faqJsonLd(faq)}</script>
</head>
<body class="theme-souzoku" data-site="souzoku" data-page-type="okuyami">
  ${HEADER}
  <main id="top">
    <section class="page-hero">
      <div class="wrap narrow">
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1>${esc(h1)}</h1>
        <p>${esc(lead)}</p>
      </div>
    </section>
${body}
${footerCta()}
${sourceNote()}
  </main>
  ${COMPANY_INFO}
  ${MANAGED_FOOTER}
  ${STICKY_CTA}
  <script src="../script.js"></script>
${extraScripts}<script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script>
</body>
</html>
`;
  writeFileSync(join(DIR, file), html, 'utf8');
  console.log(`  書き出し: souzoku/okuyami/${file} (${html.length.toLocaleString()} bytes)`);
}

export { page, aioBlock, deadlineAlert, strongCard, buildingMap, esc, telLink, anchor, win, bld, q, ext, D, ND, CTA, DIR };
