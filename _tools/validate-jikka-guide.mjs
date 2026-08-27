import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guideRoot = path.join(root, 'jikka-guide');
const manifest = JSON.parse(fs.readFileSync(path.join(guideRoot, 'generated-pages.json'), 'utf8'));
const completeDataPath = path.join(guideRoot,'data','complete-pages.json');
const completedPages = fs.existsSync(completeDataPath)
  ? new Map(JSON.parse(fs.readFileSync(completeDataPath,'utf8')).pages.map((page)=>[page.slug,page])) : new Map();
const strictAssets = process.argv.includes('--strict-assets');
const expected = Number(process.argv.find((x)=>x.startsWith('--expected='))?.split('=')[1] || manifest.length);
const errors = [];
const warnings = [];
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
  const chars = strip(main).length;
  if (chars < 10000) errors.push(`${slug}: 本文が ${chars}字（10,000字未満）`);
  if (chars > 14500) errors.push(`${slug}: 本文が ${chars}字（品質目安14,000字を大きく超過）`);
  const placeholders = ['今回の確認目的','この確認テーマ','関連項目','確認する内容：','相談の焦点'];
  for (const placeholder of placeholders) if (strip(main).includes(placeholder)) errors.push(`${slug}: placeholder語が残っています: ${placeholder}`);
  if (/「「|」」/.test(strip(main))) errors.push(`${slug}: 二重かぎ括弧が残っています`);
  const repeatedLabel = strip(main).match(/(?:要点|避けたいこと|行動|確認方法|判断境界|記録と行動)：([^：]{2,48})：\1/);
  if (repeatedLabel) errors.push(`${slug}: 同語反復の箇条書きがあります: ${repeatedLabel[0]}`);
  if ((main.match(/class="scope-note"/g)||[]).length!==1) errors.push(`${slug}: 共通免責箱は末尾1件だけ必要です`);
  const sectionCount = (main.match(/class="article-section"/g)||[]).length;
  if (sectionCount !== 14) errors.push(`${slug}: 章数が ${sectionCount}件（14章必要）`);
  const bodyCtaCount = (main.match(/href="\/karte\/"/g)||[]).length;
  if (bodyCtaCount > 3) errors.push(`${slug}: 本文CTAが ${bodyCtaCount}件（上限3件）`);
  const intent = completedPages.get(slug)?.searchIntent;
  if (intent) {
    const intentCount = strip(main).split(intent).length - 1;
    if (intentCount > 3) errors.push(`${slug}: 検索意図の完全一致が ${intentCount}回（上限3回）`);
  }
  const sectionHtml = [...main.matchAll(/<section class="article-section"[\s\S]*?<\/section>/gi)].map((m)=>m[0]).join('\n');
  const pageData = completedPages.get(slug);
  if (pageData) {
    const sectionBlocks = [...main.matchAll(/<section class="article-section"[\s\S]*?<\/section>/gi)].map((m)=>strip(m[0]));
    pageData.sections.forEach((section,index)=>{
      const block = sectionBlocks[index] || '';
      for (const [label,value,limit] of [['章題',section.heading,2],['具体例',section._concreteExample,1],['注意点',section._caution,1],['次の行動',section._nextAction,1]]) {
        if (!value) continue;
        const count = block.split(value).length-1;
        if (count>limit) errors.push(`${slug}: 第${index+1}章の${label}が${count}回（上限${limit}）`);
      }
      if (index===13 && (block.match(/カルテ/g)||[]).length>4) errors.push(`${slug}: 第14章のカルテ言及が4回超過`);
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
else console.log(`jikka-guide: ${manifest.length}件を検証しました（エラー0、警告${warnings.length}）`);
