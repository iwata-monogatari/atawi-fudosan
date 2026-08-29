#!/usr/bin/env node
/*
 * 作り直した記事1本が新仕様を満たすかを、その場で測るための道具。
 * 執筆エージェントが自分の出力を確認するために使う。
 *
 *   node _tools/check-rebuilt.mjs <slug> [--new]
 *
 * --new を付けると新規記事モードになり、hero/pictograms の完成形チェックを
 * skip する（新規記事は heroPlan/pictogramPlan の段階で書き、hero画像の
 * 割り付けとピクトグラムSVGの生成は後工程でまとめて行うため）。
 *
 * 合格なら終了コード0、不足があれば1を返し、何がどれだけ足りないかを出す。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC, countBodyChars, countFigures } from './build-jikka-guide.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isNew = process.argv.includes('--new');
const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node _tools/check-rebuilt.mjs <slug>');
  process.exit(1);
}

const file = path.join(root, 'jikka-guide/data/rebuilt', `${slug}.json`);
if (!fs.existsSync(file)) {
  console.error(`× ファイルがありません: ${file}`);
  process.exit(1);
}

let page;
try {
  page = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`× JSONとして読めません: ${error.message}`);
  process.exit(1);
}
if (page.pages) page = page.pages[0]; // {pages:[...]} 形式でも受ける

const problems = [];
const sections = Array.isArray(page.sections) ? page.sections : [];
const body = countBodyChars(page);
const figures = countFigures(page);
const needFigures = Math.max(SPEC.minFigures, Math.round(body / SPEC.charsPerFigure));

console.log(`--- ${slug} ---`);
console.log(`本文        ${body}字        (必要 ${SPEC.minBodyChars}〜${SPEC.maxBodyChars}、狙い 10000〜11500)`);
console.log(`見出し      ${sections.length}件         (必要 ${SPEC.minSections}〜${SPEC.maxSections})`);
console.log(`挿絵        ${figures}枚         (この字数なら ${needFigures}枚必要)`);

if (body < SPEC.minBodyChars) problems.push(`本文が${SPEC.minBodyChars - body}字足りません`);
if (body > SPEC.maxBodyChars) problems.push(`本文が${body - SPEC.maxBodyChars}字多すぎます`);
if (sections.length < SPEC.minSections || sections.length > SPEC.maxSections) {
  problems.push(`見出しは${SPEC.minSections}〜${SPEC.maxSections}件にしてください（現在${sections.length}件）`);
}
if (figures < needFigures) problems.push(`挿絵が${needFigures - figures}枚足りません`);

sections.forEach((section, index) => {
  const chars = [section.intro, ...(section.paragraphs || []), ...(section.checklist || []),
    ...((section.table?.rows || []).flat())].filter(Boolean).join('').replace(/\s/g, '').length;
  const mark = chars < 1700 ? ' ← 薄い' : chars > 2600 ? ' ← 厚い' : '';
  console.log(`  ${index + 1}. ${chars}字${mark}  ${String(section.heading || '(見出しなし)').slice(0, 30)}`);
  if (!section.heading) problems.push(`第${index + 1}章に heading がありません`);
});

const requiredKeys = ['slug', 'title', 'description', 'lead', 'category', 'published', 'modified'];
if (!isNew) requiredKeys.push('hero', 'pictograms');
for (const key of requiredKeys) {
  if (!page[key]) problems.push(`${key} がありません`);
}
if (isNew) {
  if ((page.pictogramPlan || []).length !== 4) problems.push(`pictogramPlan は4件必要です（現在${(page.pictogramPlan || []).length}件）`);
  if (!page.heroPlan && !page.hero) problems.push('heroPlan（または hero）がありません');
} else if ((page.pictograms || []).length !== 4) {
  problems.push(`pictograms は4件必要です（現在${(page.pictograms || []).length}件）`);
}
if ((page.faqs || []).length < 2) problems.push('faqs は2件以上必要です');
if ((page.sources || []).length < 1) problems.push('sources が必要です');

if (problems.length) {
  console.log('\n× 未達:');
  for (const p of problems) console.log(`   - ${p}`);
  process.exit(1);
}
console.log('\n○ 新仕様を満たしています');
