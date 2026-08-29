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
/* 見出しを「」で引用するとき、見出し自体が既に「」で始まる/終わる場合は
   二重かぎ括弧（「「…」」）になってしまう。その場合は外側の引用符を付けない。 */
const quoteHeading = (heading = '') =>
  heading.startsWith('「') || heading.endsWith('」') ? esc(heading) : `「${esc(heading)}」`;

/* ------------------------------------------------------------------ *
 * 記事仕様（2026-08-29 改定）
 *   本文10,000字以上 / 2,000字に見出し1つ（＝5〜6章） / 3,350字に挿絵1枚（＝3枚以上）
 *   JIKKA_GUIDE_LEGACY=1 を付けると旧仕様（14章・挿絵なし）のデータも生成できる。
 * ------------------------------------------------------------------ */
export const SPEC = {
  minSections: 5,
  maxSections: 6,
  minBodyChars: 10000,
  maxBodyChars: 14000,
  charsPerHeading: 2000,
  charsPerFigure: 3350,
  minFigures: 3,
};
const LEGACY = process.env.JIKKA_GUIDE_LEGACY === '1';
const PARTIAL = process.env.JIKKA_GUIDE_PARTIAL === '1';

const countChars = (value) => String(value ?? '').replace(/\s/g, '').length;

/** 本文字数＝lead＋各sectionのintro/paragraphs/checklist/table本文（見出し・図解は含めない） */
export function countBodyChars(page) {
  let total = countChars(page.lead);
  for (const section of asArray(page.sections)) {
    total += countChars(section.intro);
    for (const paragraph of asArray(section.paragraphs)) total += countChars(paragraph);
    for (const item of asArray(section.checklist)) total += countChars(item);
    const table = section.table;
    if (table) {
      total += countChars(table.caption);
      for (const header of asArray(table.headers)) total += countChars(header);
      for (const row of asArray(table.rows)) for (const cell of asArray(row)) total += countChars(cell);
    }
  }
  return total;
}

export const countFigures = (page) => asArray(page.sections).filter((section) => section.figure).length;

function assertPage(page) {
  const required = ['slug', 'title', 'description', 'lead', 'category', 'published', 'modified'];
  for (const key of required) if (!page[key]) throw new Error(`${page.slug || '(slugなし)'}: ${key} が必要です`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) throw new Error(`${page.slug}: slug が不正です`);
  if (asArray(page.pictograms).length !== 4) throw new Error(`${page.slug}: pictograms は4件必要です`);
  if (!page.hero?.src?.endsWith('.webp')) throw new Error(`${page.slug}: hero.src は .webp を指定してください`);
  if (asArray(page.sources).length < 1) throw new Error(`${page.slug}: 公式出典が必要です`);
  if (asArray(page.faqs).length < 2) throw new Error(`${page.slug}: FAQ は2件以上必要です`);
  const sectionCount = asArray(page.sections).length;
  if (LEGACY) {
    // 移行期はデータセットに新旧が混在する。旧仕様(6章以上)か新仕様(5〜6章)の
    // どちらかを満たせば通す。どちらでもないものだけを弾く。
    if (sectionCount >= 6) return;
    if (sectionCount === SPEC.minSections) return;
    throw new Error(`${page.slug}: sections が${sectionCount}件。旧仕様は6件以上、新仕様は${SPEC.minSections}件必要です（旧仕様モード）`);
  }
  const hint = 'JIKKA_GUIDE_LEGACY=1 を付けると旧仕様データのまま生成できます';
  if (sectionCount < SPEC.minSections || sectionCount > SPEC.maxSections) {
    throw new Error(`${page.slug}: sections は${SPEC.minSections}〜${SPEC.maxSections}件必要です（現在${sectionCount}件）。${hint}`);
  }
  const bodyChars = countBodyChars(page);
  if (bodyChars < SPEC.minBodyChars) {
    throw new Error(`${page.slug}: 本文が${bodyChars}字（${SPEC.minBodyChars.toLocaleString()}字以上必要）。${hint}`);
  }
  const figures = countFigures(page);
  const requiredFigures = Math.max(SPEC.minFigures, Math.round(bodyChars / SPEC.charsPerFigure));
  if (figures < requiredFigures) {
    throw new Error(`${page.slug}: 挿絵が${figures}枚（本文${bodyChars}字には${requiredFigures}枚必要）。${hint}`);
  }
}

/* ------------------------------------------------------------------ *
 * 本文中の図解（記事ごとに固有のインラインSVG）
 *   type: flow    … 手順フロー（順番のある工程を縦に積む）
 *   type: relation… 関係図（中心の対象と、関わる立場・権限の関係）
 *   type: matrix  … 判断マトリクス（2軸で選択肢を仕分ける）
 * ------------------------------------------------------------------ */
const SVG_W = 680;
const KINSOKU = '、。，．）」』】〕｝］！？!?・：；ー〜…ぁぃぅぇぉっゃゅょゎゝ々';

function wrapText(text, max) {
  const limit = Math.max(4, Math.floor(max));
  const lines = [];
  let current = '';
  for (const char of String(text ?? '')) {
    if (current.length >= limit && KINSOKU.includes(char)) { current += char; continue; }
    if (current.length >= limit) { lines.push(current); current = char; continue; }
    current += char;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function svgText(lines, { x, y, cls = 'gf-body', size = 14.5, lh = 20, anchor = 'start' }) {
  const spans = lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lh}">${esc(line)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" class="${cls}" font-size="${size}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>${spans}</text>`;
}

const arrowDown = (x, y) => `<path class="gf-arrow" d="M${x - 7},${y - 10} L${x + 7},${y - 10} L${x},${y} Z"/>`;
const arrowRight = (x, y) => `<path class="gf-arrow" d="M${x - 10},${y - 7} L${x - 10},${y + 7} L${x},${y} Z"/>`;
const boxClass = (tone) => tone === 'warm' ? 'gf-box gf-box--warm' : tone === 'plain' ? 'gf-box gf-box--plain' : 'gf-box';

function stepBadge(label, centerX, top) {
  const text = String(label ?? '');
  if (text.length <= 2) {
    return `<circle class="gf-badge" cx="${centerX}" cy="${top + 27}" r="18"/>`
      + `<text class="gf-badge-text" x="${centerX}" y="${top + 33}" font-size="16" text-anchor="middle">${esc(text)}</text>`;
  }
  const size = text.length <= 3 ? 14 : text.length <= 4 ? 12 : 10;
  return `<rect class="gf-badge" x="${centerX - 27}" y="${top + 13}" width="54" height="28" rx="9"/>`
    + `<text class="gf-badge-text" x="${centerX}" y="${top + 32}" font-size="${size}" text-anchor="middle">${esc(text)}</text>`;
}

function figureFlow(fig) {
  const boxX = 60;
  const boxW = SVG_W - boxX - 6;
  const padX = 16;
  const innerW = boxW - padX * 2;
  const titlePer = innerW / 17;
  const bodyPer = innerW / 14.5;
  const gap = 32;
  const parts = [];
  let y = 0;
  asArray(fig.steps).forEach((step, index) => {
    const titleLines = wrapText(step.title, titlePer);
    const bodyLines = step.body ? wrapText(step.body, bodyPer) : [];
    const height = 16 + titleLines.length * 24 + (bodyLines.length ? 8 + bodyLines.length * 20 : 0) + 16;
    if (index > 0) {
      parts.push(`<path class="gf-line" d="M30,${y - gap} L30,${y - 4}"/>`, arrowDown(30, y + 4));
    }
    parts.push(`<rect class="${boxClass(step.tone)}" x="${boxX}" y="${y}" width="${boxW}" height="${height}" rx="12"/>`);
    parts.push(stepBadge(step.label ?? String(index + 1), 30, y));
    parts.push(svgText(titleLines, { x: boxX + padX, y: y + 33, cls: 'gf-title', size: 17, lh: 24 }));
    if (bodyLines.length) {
      parts.push(svgText(bodyLines, { x: boxX + padX, y: y + 16 + titleLines.length * 24 + 23, size: 14.5, lh: 20 }));
    }
    y += height + gap;
  });
  y -= gap;
  if (fig.note) {
    const noteLines = wrapText(fig.note, (SVG_W - boxX) / 13);
    parts.push(svgText(noteLines, { x: boxX, y: y + 26, cls: 'gf-muted', size: 13, lh: 18 }));
    y += 12 + noteLines.length * 18;
  }
  return { inner: parts.join(''), height: y + 6 };
}

function figureRelation(fig) {
  const centerW = 172;
  const nodeX = 322;
  const nodeW = SVG_W - nodeX;
  const padX = 14;
  const nodeTitlePer = (nodeW - padX * 2) / 16;
  const nodeBodyPer = (nodeW - padX * 2) / 14;
  const gap = 20;
  const nodes = asArray(fig.nodes).map((node) => {
    const titleLines = wrapText(node.title, nodeTitlePer);
    const bodyLines = node.body ? wrapText(node.body, nodeBodyPer) : [];
    const height = 14 + titleLines.length * 22 + (bodyLines.length ? 6 + bodyLines.length * 19 : 0) + 14;
    return { ...node, titleLines, bodyLines, height };
  });
  const stackHeight = nodes.reduce((sum, node) => sum + node.height, 0) + gap * Math.max(0, nodes.length - 1);
  const centerTitleLines = wrapText(fig.center?.title, (centerW - 24) / 15);
  const centerBodyLines = fig.center?.body ? wrapText(fig.center.body, (centerW - 24) / 12.5) : [];
  const centerHeight = 14 + centerTitleLines.length * 21 + (centerBodyLines.length ? 6 + centerBodyLines.length * 17 : 0) + 14;
  const height = Math.max(stackHeight, centerHeight);
  const centerTop = (height - centerHeight) / 2;
  const centerMid = centerTop + centerHeight / 2;
  const parts = [];
  const busX = 212;
  parts.push(`<rect class="gf-box gf-box--warm" x="0" y="${centerTop.toFixed(1)}" width="${centerW}" height="${centerHeight}" rx="12"/>`);
  parts.push(svgText(centerTitleLines, { x: 12, y: centerTop + 30, cls: 'gf-title', size: 15, lh: 21 }));
  if (centerBodyLines.length) {
    parts.push(svgText(centerBodyLines, { x: 12, y: centerTop + 14 + centerTitleLines.length * 21 + 20, cls: 'gf-muted', size: 12.5, lh: 17 }));
  }
  let y = 0;
  const pills = [];
  for (const node of nodes) {
    const mid = y + node.height / 2;
    parts.push(`<path class="gf-line" d="M${centerW},${centerMid.toFixed(1)} L${busX},${centerMid.toFixed(1)} L${busX},${mid.toFixed(1)} L${nodeX - 12},${mid.toFixed(1)}"/>`);
    parts.push(arrowRight(nodeX - 2, mid));
    parts.push(`<rect class="${boxClass(node.tone)}" x="${nodeX}" y="${y}" width="${nodeW}" height="${node.height}" rx="12"/>`);
    parts.push(svgText(node.titleLines, { x: nodeX + padX, y: y + 31, cls: 'gf-title', size: 16, lh: 22 }));
    if (node.bodyLines.length) {
      parts.push(svgText(node.bodyLines, { x: nodeX + padX, y: y + 14 + node.titleLines.length * 22 + 21, size: 14, lh: 19 }));
    }
    if (node.relation) {
      const labelLines = wrapText(node.relation, 7);
      const pillW = Math.max(56, Math.max(...labelLines.map((line) => line.length)) * 13 + 16);
      const pillH = labelLines.length * 16 + 10;
      const cx = (busX + nodeX - 12) / 2;
      pills.push(`<rect class="gf-panel" x="${(cx - pillW / 2).toFixed(1)}" y="${(mid - pillH / 2).toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="8"/>`);
      pills.push(svgText(labelLines, { x: cx.toFixed(1), y: (mid - pillH / 2 + 15).toFixed(1), cls: 'gf-axis', size: 12.5, lh: 16, anchor: 'middle' }));
    }
    y += node.height + gap;
  }
  parts.push(...pills);
  let total = height;
  if (fig.note) {
    const noteLines = wrapText(fig.note, SVG_W / 13);
    parts.push(svgText(noteLines, { x: 0, y: total + 26, cls: 'gf-muted', size: 13, lh: 18 }));
    total += 12 + noteLines.length * 18;
  }
  return { inner: parts.join(''), height: total + 6 };
}

function figureMatrix(fig) {
  const gutter = 106;
  const gapX = 12;
  const gapY = 12;
  const columns = asArray(fig.columns);
  const colW = (SVG_W - gutter - gapX * (columns.length - 1)) / columns.length;
  const padX = 13;
  const titlePer = (colW - padX * 2) / 16;
  const bodyPer = (colW - padX * 2) / 14;
  const parts = [];
  let y = 0;
  if (fig.axisNote) {
    const lines = wrapText(fig.axisNote, SVG_W / 13);
    parts.push(svgText(lines, { x: 0, y: 13, cls: 'gf-axis', size: 13, lh: 18 }));
    y += lines.length * 18 + 10;
  }
  const headerLines = columns.map((column) => wrapText(column.label, (colW - 16) / 15));
  const headerRows = Math.max(...headerLines.map((lines) => lines.length));
  columns.forEach((column, index) => {
    const x = gutter + index * (colW + gapX);
    parts.push(`<rect class="gf-panel" x="${x.toFixed(1)}" y="${y}" width="${colW.toFixed(1)}" height="${headerRows * 21 + 12}" rx="8"/>`);
    parts.push(svgText(headerLines[index], { x: (x + colW / 2).toFixed(1), y: y + 22, cls: 'gf-title', size: 15, lh: 21, anchor: 'middle' }));
  });
  y += headerRows * 21 + 12 + gapY;
  for (const row of asArray(fig.rows)) {
    const cells = asArray(row.cells).map((cell) => {
      const titleLines = wrapText(cell.title, titlePer);
      const bodyLines = cell.body ? wrapText(cell.body, bodyPer) : [];
      return { ...cell, titleLines, bodyLines, height: 13 + titleLines.length * 22 + (bodyLines.length ? 6 + bodyLines.length * 19 : 0) + 13 };
    });
    const rowLabelLines = wrapText(row.label, (gutter - 14) / 13);
    const rowH = Math.max(...cells.map((cell) => cell.height), rowLabelLines.length * 18 + 20);
    parts.push(svgText(rowLabelLines, { x: 0, y: y + (rowH - rowLabelLines.length * 18) / 2 + 14, cls: 'gf-axis', size: 13, lh: 18 }));
    cells.forEach((cell, index) => {
      const x = gutter + index * (colW + gapX);
      parts.push(`<rect class="${boxClass(cell.tone)}" x="${x.toFixed(1)}" y="${y}" width="${colW.toFixed(1)}" height="${rowH}" rx="12"/>`);
      parts.push(svgText(cell.titleLines, { x: (x + padX).toFixed(1), y: y + 31, cls: 'gf-title', size: 16, lh: 22 }));
      if (cell.bodyLines.length) {
        parts.push(svgText(cell.bodyLines, { x: (x + padX).toFixed(1), y: y + 13 + cell.titleLines.length * 22 + 21, size: 14, lh: 19 }));
      }
    });
    y += rowH + gapY;
  }
  y -= gapY;
  if (fig.note) {
    const noteLines = wrapText(fig.note, SVG_W / 13);
    parts.push(svgText(noteLines, { x: 0, y: y + 26, cls: 'gf-muted', size: 13, lh: 18 }));
    y += 12 + noteLines.length * 18;
  }
  return { inner: parts.join(''), height: y + 6 };
}

const FIGURE_BUILDERS = { flow: figureFlow, relation: figureRelation, matrix: figureMatrix };

function renderFigure(figure, number) {
  const build = FIGURE_BUILDERS[figure.type];
  if (!build) throw new Error(`未対応の図解タイプです: ${figure.type}（利用可能: ${Object.keys(FIGURE_BUILDERS).join(', ')}）`);
  if (!figure.title || !figure.caption) throw new Error(`図${number}: title と caption が必要です`);
  const { inner, height } = build(figure);
  const titleId = `figure-${number}-title`;
  const descId = `figure-${number}-desc`;
  return `<figure class="guide-figure" id="figure-${number}"><p class="guide-figure__head"><span class="guide-figure__no">図${number}</span>${esc(figure.title)}</p>`
    + `<div class="guide-figure__frame"><svg viewBox="0 0 ${SVG_W} ${Math.round(height)}" role="img" aria-labelledby="${titleId} ${descId}" xmlns="http://www.w3.org/2000/svg">`
    + `<title id="${titleId}">${esc(figure.title)}</title><desc id="${descId}">${esc(figure.caption)}</desc>${inner}</svg></div>`
    + `<figcaption>${esc(figure.caption)}</figcaption></figure>`;
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

function renderSection(section, index, figureHtml = '') {
  const paragraphs = asArray(section.paragraphs).map((p) => `<p>${esc(p)}</p>`).join('\n');
  const checklist = asArray(section.checklist).length
    ? `<ul class="check-list">${section.checklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const table = asArray(section.table?.rows).length
    ? `<div class="table-scroll"><table><caption>${esc(section.table.caption || section.heading)}</caption><thead><tr>${asArray(section.table.headers).map((x) => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  return `<section class="article-section" id="section-${index + 1}"><h2>${esc(section.heading)}</h2>${section.intro ? `<p class="section-lead">${esc(section.intro)}</p>` : ''}${paragraphs}${checklist}${table}${figureHtml}</section>`;
}

function renderSections(page) {
  let figureNumber = 0;
  return page.sections
    .map((section, index) => renderSection(section, index, section.figure ? renderFigure(section.figure, ++figureNumber) : ''))
    .join('\n');
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
<link rel="stylesheet" href="/assets/site-header.css?v=20260724-brand"><link rel="stylesheet" href="/jikka-guide/assets/guide.css?v=20260829-figure"><script type="application/ld+json">${json(schemas)}</script></head><body>
${header()}<main><nav class="breadcrumb" aria-label="パンくず"><a href="/">ホーム</a><span>›</span><a href="/jikka-guide/">実家ガイド</a><span>›</span><span>${esc(page.title)}</span></nav>
<article class="guide-article"><header class="article-hero"><p class="article-meta">${esc(page.category)}｜${esc(page.published)}</p><h1>${esc(page.title)}</h1><p class="article-lead">${esc(page.lead)}</p><img class="hero-image" src="${esc(hero)}" width="1200" height="675" alt="${esc(page.hero.alt)}" fetchpriority="high"></header>
<section class="answer-box"><p class="answer-box__label">まず結論</p><p>${esc(page.summary)}</p></section><aside class="reading-guide" aria-label="このページの使い方"><h2>このページの使い方</h2><p>「${esc(page.title)}」は、最初から一つの結論を選ぶための記事ではありません。まず${quoteHeading(page.sections[0].heading)}で現在地を確かめ、次に${quoteHeading(page.sections[1].heading)}と${quoteHeading(page.sections[2].heading)}で手元資料や現況を整理してください。途中の章は、確認できた項目だけを記録すれば構いません。</p><p>各章末の三項目は、確認方法、判断を止める境界、記録する行動を示しています。分からない項目には推測を書かず、担当者と再確認日を付けます。最後の${quoteHeading(page.sections.at(-1).heading)}まで進んだら、公式出典を開いて条件の更新日を確かめ、家族へ同じ記録を共有してください。</p></aside><section class="pictogram-grid" aria-label="この記事で確認する4つの要点">${pictograms}</section>
<nav class="toc" aria-label="目次"><strong>この記事の内容</strong><ol>${(()=>{let n=0;return page.sections.map((x,i)=>{const f=x.figure?`<span class="toc__figure">図${++n}｜${esc(x.figure.title)}</span>`:'';return `<li><a href="#section-${i+1}">${esc(x.heading)}</a>${f}</li>`;}).join('');})()}<li><a href="#faq">よくある質問</a></li><li><a href="#sources">公式出典</a></li></ol></nav>
${renderSections(page)}${page.scopeNote?`<aside class="scope-note"><h2>このガイドで扱う範囲</h2><p>${esc(page.scopeNote)}</p></aside>`:''}${cta(page.ctaLabel)}
<section class="page-specific-notes"><h2>このページ固有の確認メモ</h2><p>ここからは「${esc(page.title)}」で特に確認したい内容を、事実、避けたい判断、手元資料に分けて示します。すべてを一度に終える必要はありません。確認できた項目には日付と根拠を添え、分からない項目には担当者と再確認日を付けてください。家族が別々の時間に作業しても、同じ一覧へ戻れる状態を目指します。</p><div class="notes-grid"><div><h3>確認しておく事実</h3><p>この欄は、方針を決める前に共有したい事実です。家族の記憶だけで確定せず、通知書、契約書、公式ページ、撮影日が分かる写真など、確認に使った根拠を隣へ書きます。該当しない項目も削除せず「該当なし」とした理由を残すと、後から同じ調査を繰り返さずに済みます。</p><ul>${page.fieldNotes.keyPoints.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>避けたい判断</h3><p>この欄に当てはまる可能性があるときは、契約や処分をいったん止めます。一般例を対象の家へ当てはめたのか、資料で確かめたのかを区別し、不足情報を質問へ直してください。法務、税務、測量、建物、行政など別分野の判断が必要なら、回答できる相談先へ切り分けます。</p><ul>${page.fieldNotes.pitfalls.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>手元で探すもの</h3><p>見つけた資料には名称、発行年、原本の保管者を記します。古い資料も経緯を知る手掛かりになるため、最新版と違うだけで捨てないでください。見つからない場合は空欄にせず、再取得できるか、誰に所在を尋ねるか、いつ再確認するかを決めると次の相談準備になります。</p><ul>${page.fieldNotes.checklist.map((x)=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></section>
<aside class="notes-handoff"><h2>家族へ共有するとき</h2><p>確認済みと保留を色分けし、更新した人と日付を末尾へ記してください。口頭で補足した内容も短く追記し、原本の保管場所と次の確認担当を添えます。同じ一覧を見ながら話せば、次の相談で経緯を説明し直す負担を減らせます。</p></aside>
<section id="faq" class="faq-section"><h2>よくある質問</h2>${page.faqs.map((x)=>`<details><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join('')}</section>
<section id="sources" class="sources"><h2>公式出典・確認先</h2><p>制度や受付条件は変わることがあります。最終判断の前に、リンク先の最新情報と担当窓口を確認してください。</p><ol>${sources}</ol></section>
${related ? `<nav class="related" aria-label="関連ページ"><h2>次に読むページ</h2><ul>${related}</ul></nav>` : ''}
<section class="author reviewer-card" aria-labelledby="reviewer-heading"><img class="reviewer-card__photo" src="/jikka-guide/assets/reviewer-oishi.jpg" width="1080" height="1080" alt="この記事を確認した大石浩之" loading="lazy"><div><h2 id="reviewer-heading">この記事の確認者</h2><p><strong><a href="https://oishi-hiroyuki.org/" rel="author noopener">大石 浩之</a></strong></p><p>富士ヶ丘サービス株式会社 代表取締役・宅地建物取引士（静岡県知事 第027186号）。静岡県磐田市見付を拠点に、磐田市・袋井市・森町・掛川市・浜松市の一部で、相続不動産・空き家・実家じまいの相談に対応。家族が次に確認する事項を、判断を急がず、地域の実務と公的情報を分けながら整理しています。</p></div></section></article></main><footer class="fgo-global-footer-shell"></footer>
<script defer src="/assets/ai-referral.js?v=20260723"></script><script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script></body></html>`;
}

/* 読者の状況で絞り込むUI。カテゴリ（提供側の分類）だと「テーマが多すぎて絞れない」
   ため、読者が自分について答えられる3問に置き換えている。
   JS無効時はfilter-barごと隠し、全記事が並んだ従来の一覧として機能する。 */
function renderFilter() {
  const facets = asArray(hub.facets);
  if (!facets.length) return '';
  const groups = facets.map((facet) => {
    const options = asArray(facet.options).map((option) =>
      `<button type="button" class="facet-chip" data-facet="${esc(facet.key)}" data-value="${esc(option.value)}">${esc(option.label)}</button>`
    ).join('');
    return `<fieldset class="facet-group"><legend>${esc(facet.label)}</legend><div class="facet-chips">${options}</div></fieldset>`;
  }).join('');
  return `<section class="guide-filter" id="guideFilter" hidden aria-label="記事の絞り込み">
  <p class="guide-filter__lead">あてはまるものを選ぶと、読む記事が絞られます。答えられる問だけで構いません。</p>
  ${groups}
  <p class="guide-filter__status"><output id="filterCount" role="status"></output><button type="button" class="facet-reset" id="filterReset" hidden>選び直す</button></p>
</section>`;
}

function renderHub() {
  const cards = pages.map((page) => {
    const facets = page.facets || {};
    const data = Object.entries(facets).map(([key, value]) => ` data-${esc(key)}="${esc(value)}"`).join('');
    return `<article class="guide-card"${data}><p>${esc(page.category)}</p><h2><a href="/jikka-guide/${esc(page.slug)}/">${esc(page.title)}</a></h2><p>${esc(page.description)}</p><a class="text-link" href="/jikka-guide/${esc(page.slug)}/">確認する順番を読む →</a></article>`;
  }).join('');
  const title = hub.title || '実家の状況別ガイド';
  const description = hub.description || '実家じまい、相続、空き家管理で迷ったときに、確認する順番を状況別に整理するガイドです。';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}｜ふじがおか実家カルテ</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${siteOrigin}/jikka-guide/"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${siteOrigin}/jikka-guide/"><link rel="stylesheet" href="/assets/site-header.css?v=20260724-brand"><link rel="stylesheet" href="/jikka-guide/assets/guide.css?v=20260829-figure"><script type="application/ld+json">${json({'@context':'https://schema.org','@type':'CollectionPage',name:title,description,url:`${siteOrigin}/jikka-guide/`,hasPart:pages.map((p)=>({'@type':'Article',name:p.title,url:`${siteOrigin}/jikka-guide/${p.slug}/`}))})}</script></head><body>${header()}<main><section class="hub-hero"><p>ふじがおか実家カルテ</p><h1>${esc(title)}</h1><p>${esc(description)}</p><a class="button button--primary" href="/karte/">住所から無料で整理する</a></section>${renderFilter()}<section class="guide-grid" id="guideGrid" aria-label="実家ガイド一覧">${cards}</section><p class="guide-empty" id="guideEmpty" hidden>その組み合わせに当てはまる記事はまだありません。条件をひとつ減らすか、<a href="/karte/">住所を送って直接相談</a>してください。</p>${cta()}</main><footer class="fgo-global-footer-shell"></footer>${hubScript()}</body></html>`;
}

function hubScript() {
  return `<script>
(function(){
  var filter=document.getElementById('guideFilter');
  var grid=document.getElementById('guideGrid');
  if(!filter||!grid){return;}
  filter.hidden=false; // JSが動くときだけ絞り込みを出す
  var cards=[].slice.call(grid.querySelectorAll('.guide-card'));
  var countEl=document.getElementById('filterCount');
  var resetEl=document.getElementById('filterReset');
  var emptyEl=document.getElementById('guideEmpty');
  var chips=[].slice.call(filter.querySelectorAll('.facet-chip'));
  var selected={};
  function apply(){
    var keys=Object.keys(selected);
    var shown=0;
    cards.forEach(function(card){
      var ok=keys.every(function(k){return card.getAttribute('data-'+k)===selected[k];});
      card.hidden=!ok;
      if(ok){shown++;}
    });
    if(emptyEl){emptyEl.hidden=shown!==0;}
    if(countEl){
      countEl.textContent=keys.length
        ? shown+'件が当てはまります（全'+cards.length+'件中）'
        : '全'+cards.length+'件';
    }
    if(resetEl){resetEl.hidden=keys.length===0;}
  }
  chips.forEach(function(chip){
    chip.addEventListener('click',function(){
      var k=chip.getAttribute('data-facet'),v=chip.getAttribute('data-value');
      var on=selected[k]===v;
      // 同じ軸の他の選択を外してから、押されたものだけを立てる（単一選択）
      filter.querySelectorAll('[data-facet="'+k+'"]').forEach(function(sib){
        sib.classList.remove('is-on');sib.setAttribute('aria-pressed','false');
      });
      if(on){delete selected[k];}
      else{selected[k]=v;chip.classList.add('is-on');chip.setAttribute('aria-pressed','true');}
      apply();
    });
    chip.setAttribute('aria-pressed','false');
  });
  if(resetEl){resetEl.addEventListener('click',function(){
    selected={};
    chips.forEach(function(c){c.classList.remove('is-on');c.setAttribute('aria-pressed','false');});
    apply();
  });}
  apply();
})();
</script>`;
}

/* ここから下は実際の生成処理。check-rebuilt.mjs などが SPEC や countBodyChars を
   import するときに走らないよう、直接実行されたときだけ動かす。 */
const IS_MAIN = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (IS_MAIN) {
fs.mkdirSync(guideRoot, { recursive: true });
if (!PARTIAL) fs.writeFileSync(path.join(guideRoot, 'index.html'), renderHub(), 'utf8');
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
if (!PARTIAL) fs.writeFileSync(path.join(guideRoot, 'generated-pages.json'), `${JSON.stringify(pages.map((p)=>p.slug), null, 2)}\n`, 'utf8');
if (!PARTIAL) {
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
{
  const report = pages.map((page) => `${page.slug}（本文${countBodyChars(page)}字・見出し${asArray(page.sections).length}・挿絵${countFigures(page)}枚）`);
  if (PARTIAL) {
    console.log(`jikka-guide: 部分ビルド。詳細${pages.length}件のみ生成しました（ハブ／generated-pages.json／sitemapは更新なし）`);
  } else {
    console.log(`jikka-guide: ハブ1件、詳細${pages.length}件を生成し、sitemap-core.xmlを同期しました`);
  }
  if (pages.length <= 5) for (const line of report) console.log(`  - ${line}`);
}

}
