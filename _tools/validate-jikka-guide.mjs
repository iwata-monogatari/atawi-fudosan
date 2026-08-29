import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideRoot = path.join(root, 'jikka-guide');
const manifest = JSON.parse(fs.readFileSync(path.join(guideRoot, 'generated-pages.json'), 'utf8'));
const completeDataPath = path.join(guideRoot,'data','complete-pages.json');
const completedPages = fs.existsSync(completeDataPath)
  ? new Map(JSON.parse(fs.readFileSync(completeDataPath,'utf8')).pages.map((page)=>[page.slug,page])) : new Map();
// パイロットなど部分データセットは JIKKA_GUIDE_DATA で上書き読み込みする（build と同じ指定方法）。
if (process.env.JIKKA_GUIDE_DATA) {
  const overlayPath = path.resolve(root, process.env.JIKKA_GUIDE_DATA);
  for (const page of JSON.parse(fs.readFileSync(overlayPath,'utf8')).pages) completedPages.set(page.slug, page);
}

/* 記事仕様（2026-08-29 改定）: 本文10,000字以上／2,000字に見出し1つ（5〜6章）／3,350字に挿絵1枚（3枚以上） */
const SPEC = { minSections:5, maxSections:6, minBodyChars:10000, maxBodyChars:14000, charsPerFigure:3350, minFigures:3 };
const strictAssets = process.argv.includes('--strict-assets');
const expected = Number(process.argv.find((x)=>x.startsWith('--expected='))?.split('=')[1] || manifest.length);
const errors = [];
const warnings = [];
const specFailures = new Map(); // slug -> 新仕様に未対応な理由
const specStats = [];
const failSpec = (slug, reason) => {
  errors.push(`${slug}: ${reason}`);
  if (!specFailures.has(slug)) specFailures.set(slug, []);
  specFailures.get(slug).push(reason);
};
const crossPageSentences = new Map();
const strip = (html) => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')
  .replace(/<nav\b[\s\S]*?<\/nav>/gi, '').replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
  .replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s/g, '');

if (manifest.length !== expected) errors.push(`生成ページ数: ${manifest.length}（期待値 ${expected}）`);
if (new Set(manifest).size !== manifest.length) errors.push('slug が重複しています');
for (const slug of manifest) {
  const dir = path.join(guideRoot, slug);
  const file = path.join(dir, 'index.html');
  if (!fs.existsSync(file)) { errors.push(`${slug}: index.html がありません`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const main = html.match(/<article class="guide-article">([\s\S]*?)<\/article>/)?.[1] || '';
  // 本文＝リード文＋各章（図解のSVG内テキスト・キャプションは本文字数に数えない）
  const withoutFigures = (fragment) => fragment.replace(/<figure class="guide-figure"[\s\S]*?<\/figure>/gi, ' ');
  const leadHtml = main.match(/<p class="article-lead">([\s\S]*?)<\/p>/)?.[1] || '';
  const sectionBlocksRaw = [...main.matchAll(/<section class="article-section"[\s\S]*?<\/section>/gi)].map((m)=>m[0]);
  const bodyChars = strip(leadHtml).length
    + sectionBlocksRaw.reduce((sum, block)=>sum + strip(withoutFigures(block)).length, 0);
  const figureCount = (main.match(/class="guide-figure"/g)||[]).length;
  const sectionCount = sectionBlocksRaw.length;
  const requiredFigures = Math.max(SPEC.minFigures, Math.round(bodyChars / SPEC.charsPerFigure));
  specStats.push({ slug, bodyChars, sectionCount, figureCount });
  if (bodyChars < SPEC.minBodyChars) failSpec(slug, `本文が ${bodyChars}字（新仕様は${SPEC.minBodyChars.toLocaleString()}字以上）`);
  if (bodyChars > SPEC.maxBodyChars) failSpec(slug, `本文が ${bodyChars}字（品質目安${SPEC.maxBodyChars.toLocaleString()}字を超過）`);
  if (sectionCount < SPEC.minSections || sectionCount > SPEC.maxSections) {
    failSpec(slug, `章数が ${sectionCount}件（新仕様は2,000字に見出し1つ＝${SPEC.minSections}〜${SPEC.maxSections}章）`);
  }
  if (figureCount < requiredFigures) {
    failSpec(slug, `挿絵が ${figureCount}枚（本文${bodyChars}字なら3,350字に1枚＝${requiredFigures}枚必要）`);
  }
  if (sectionCount >= SPEC.minSections && sectionCount <= SPEC.maxSections) {
    const perHeading = Math.round(bodyChars / sectionCount);
    if (perHeading < 1500 || perHeading > 2800) warnings.push(`${slug}: 1見出しあたり ${perHeading}字（目安2,000字前後）`);
  }
  const placeholders = ['今回の確認目的','この確認テーマ','関連項目','確認する内容：','相談の焦点'];
  for (const placeholder of placeholders) if (strip(main).includes(placeholder)) errors.push(`${slug}: placeholder語が残っています: ${placeholder}`);
  if (/「「|」」/.test(strip(main))) errors.push(`${slug}: 二重かぎ括弧が残っています`);
  const repeatedLabel = strip(main).match(/(?:要点|避けたいこと|行動|確認方法|判断境界|記録と行動)：([^：]{2,48})：\1/);
  if (repeatedLabel) errors.push(`${slug}: 同語反復の箇条書きがあります: ${repeatedLabel[0]}`);
  if ((main.match(/class="scope-note"/g)||[]).length!==1) errors.push(`${slug}: 共通免責箱は末尾1件だけ必要です`);
  const bodyCtaCount = (main.match(/href="\/karte\/"/g)||[]).length;
  if (bodyCtaCount > 3) errors.push(`${slug}: 本文CTAが ${bodyCtaCount}件（上限3件）`);
  const intent = completedPages.get(slug)?.searchIntent;
  if (intent) {
    const intentCount = strip(main).split(intent).length - 1;
    if (intentCount > 3) errors.push(`${slug}: 検索意図の完全一致が ${intentCount}回（上限3回）`);
  }
  const sectionHtml = sectionBlocksRaw.map(withoutFigures).join('\n');
  const pageData = completedPages.get(slug);
  if (pageData) {
    const sectionBlocks = sectionBlocksRaw.map((block)=>strip(withoutFigures(block)));
    pageData.sections.forEach((section,index)=>{
      const block = sectionBlocks[index] || '';
      for (const [label,value,limit] of [['章題',section.heading,2],['具体例',section._concreteExample,1],['注意点',section._caution,1],['次の行動',section._nextAction,1]]) {
        if (!value) continue;
        const count = block.split(value).length-1;
        if (count>limit) errors.push(`${slug}: 第${index+1}章の${label}が${count}回（上限${limit}）`);
      }
      if (index===pageData.sections.length-1 && (block.match(/カルテ/g)||[]).length>4) errors.push(`${slug}: 最終章のカルテ言及が4回超過`);
    });
  }
  const sectionText = sectionHtml.replace(/<[^>]+>/g,'').replace(/\s+/g,'');
  for (const sentence of sectionText.split(/[。！？]/).filter((text)=>text.length>=28)) {
    if (!crossPageSentences.has(sentence)) crossPageSentences.set(sentence,new Set());
    crossPageSentences.get(sentence).add(slug);
  }
  const paragraphs = [...sectionHtml.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map((match)=>strip(match[1])).filter((text)=>text.length>=80);
  for (const paragraph of paragraphs) {
    if (/するです|しないです|たいですです|ですです/.test(paragraph)) errors.push(`${slug}: 助詞・語尾が不自然な段落があります`);
  }
  const duplicateParagraphs = paragraphs.filter((text,index)=>paragraphs.indexOf(text)!==index);
  if (duplicateParagraphs.length) errors.push(`${slug}: 長文段落の完全重複が ${new Set(duplicateParagraphs).size}件あります`);
  const grams = new Map();
  for (const paragraph of paragraphs) {
    for (let index=0;index<=paragraph.length-30;index+=1) {
      const gram = paragraph.slice(index,index+30);
      grams.set(gram,(grams.get(gram)||0)+1);
    }
  }
  const excessive = [...grams.entries()].filter(([,count])=>count>4).sort((a,b)=>b[1]-a[1]);
  if (excessive.length) errors.push(`${slug}: 同一30文字フレーズが最大${excessive[0][1]}回反復: ${excessive[0][0]}`);
  const checks = [
    ['h1が1件', (html.match(/<h1\b/g)||[]).length===1], ['canonical', /rel="canonical"/.test(html)],
    ['JSON-LD', /application\/ld\+json/.test(html)], ['Article', /"@type":"Article"/.test(html)],
    ['FAQPage', /"@type":"FAQPage"/.test(html)], ['CTA', /class="guide-cta"/.test(html)],
    ['申込リンク', /href="\/karte\/"/.test(html)], ['LINE', /line\.me/.test(html)],
    ['電話', /href="tel:/.test(html)], ['公式出典', /id="sources"/.test(html)],
    ['確認者カード', /class="author reviewer-card"/.test(html) && /この記事の確認者/.test(html)],
    ['確認者写真', /src="\/jikka-guide\/assets\/reviewer-oishi\.jpg"[^>]+width="1080"[^>]+height="1080"[^>]+alt="[^"]+"/.test(html)],
    ['reviewedBy', /"reviewedBy":\{"@type":"Person","name":"大石 浩之"/.test(html)],
    ['hero.webp', /<img class="hero-image"[^>]+\.webp/.test(html)],
    ['ピクトグラム4点', (html.match(/class="pictogram-card"/g)||[]).length===4],
    ['画像alt', !/<img\b(?![^>]*\balt="[^"]+")[^>]*>/i.test(html)],
  ];
  for (const [label, ok] of checks) if (!ok) errors.push(`${slug}: ${label} を満たしません`);
  const localImages = [...html.matchAll(/<img[^>]+src="([^"?]+)"/g)].map((m)=>m[1])
    .filter((src)=>src.startsWith('/')).map((src)=>path.join(root, src.slice(1)));
  for (const image of localImages) if (!fs.existsSync(image)) (strictAssets ? errors : warnings).push(`${slug}: 画像未配置 ${path.basename(image)}`);
}
for (const [sentence,slugs] of crossPageSentences) {
  if (slugs.size>10) errors.push(`記事横断で同一文が${slugs.size}件: ${sentence.slice(0,72)}`);
}
if (!fs.existsSync(path.join(guideRoot, 'index.html'))) errors.push('ハブページがありません');
const sitemap = fs.readFileSync(path.join(root,'sitemap-core.xml'),'utf8');
if (!sitemap.includes('<!-- jikka-guide:generated:start -->')) errors.push('sitemap-core.xml に生成範囲がありません');
for (const slug of manifest) if (!sitemap.includes(`/jikka-guide/${slug}/`)) errors.push(`${slug}: sitemap-core.xml にURLがありません`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length) { for (const error of errors) console.error(`ERROR ${error}`); process.exitCode = 1; }

/* 新仕様（本文10,000字以上／5〜6章／挿絵3枚以上）の適合状況サマリ */
{
  const ok = specStats.length - specFailures.size;
  console.log('');
  console.log('── 記事仕様（2026-08-29改定）の適合状況 ──');
  console.log(`  新仕様適合: ${ok}件 / 新仕様未対応: ${specFailures.size}件（対象${specStats.length}件）`);
  const shortBody = specStats.filter((s)=>s.bodyChars < SPEC.minBodyChars).length;
  const wrongSections = specStats.filter((s)=>s.sectionCount < SPEC.minSections || s.sectionCount > SPEC.maxSections).length;
  const lackFigures = specStats.filter((s)=>s.figureCount < Math.max(SPEC.minFigures, Math.round(s.bodyChars / SPEC.charsPerFigure))).length;
  console.log(`  内訳: 本文${SPEC.minBodyChars.toLocaleString()}字未満 ${shortBody}件 ／ 章数が${SPEC.minSections}〜${SPEC.maxSections}章でない ${wrongSections}件 ／ 挿絵が不足 ${lackFigures}件`);
  if (specFailures.size) {
    console.log('  ※ 未対応記事は書き直しが必要です（先頭5件）');
    for (const [slug, reasons] of [...specFailures].slice(0, 5)) console.log(`    - ${slug}: ${reasons.join(' / ')}`);
  }
  for (const stat of specStats.filter((s)=>!specFailures.has(s.slug)).slice(0, 5)) {
    console.log(`  OK ${stat.slug}: 本文${stat.bodyChars}字・見出し${stat.sectionCount}・挿絵${stat.figureCount}枚`);
  }
}
if (!errors.length) console.log(`jikka-guide: ${manifest.length}件を検証しました（エラー0、警告${warnings.length}）`);
