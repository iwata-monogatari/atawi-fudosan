#!/usr/bin/env node
/*
 * jikka-guide/data/rebuilt/*.json を complete-pages.json へ取り込む。
 *
 *   node _tools/merge-rebuilt.mjs          … 適合したものだけ取り込む
 *   node _tools/merge-rebuilt.mjs --dry    … 取り込まずに結果だけ出す
 *
 * 記事の並び順は元の complete-pages.json を保つ（差分を読みやすくするため）。
 * 適合しないものは取り込まず、一覧に出す。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC, countBodyChars, countFigures } from './build-jikka-guide.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const dataFile = path.join(root, 'jikka-guide/data/complete-pages.json');
const rebuiltDir = path.join(root, 'jikka-guide/data/rebuilt');

const dataset = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const files = fs.existsSync(rebuiltDir)
  ? fs.readdirSync(rebuiltDir).filter((f) => f.endsWith('.json'))
  : [];

const ready = new Map();
const rejected = [];

for (const file of files) {
  const slug = file.replace(/\.json$/, '');
  let page;
  try {
    page = JSON.parse(fs.readFileSync(path.join(rebuiltDir, file), 'utf8'));
  } catch (error) {
    rejected.push(`${slug}: JSONとして読めません (${error.message})`);
    continue;
  }
  if (page.pages) page = page.pages[0];
  if (page.slug !== slug) { rejected.push(`${slug}: slugが一致しません (${page.slug})`); continue; }

  const sections = Array.isArray(page.sections) ? page.sections : [];
  const body = countBodyChars(page);
  const figures = countFigures(page);
  const need = Math.max(SPEC.minFigures, Math.round(body / SPEC.charsPerFigure));
  const bad = [];
  if (body < SPEC.minBodyChars) bad.push(`本文${body}字`);
  if (sections.length < SPEC.minSections || sections.length > SPEC.maxSections) bad.push(`見出し${sections.length}件`);
  if (figures < need) bad.push(`挿絵${figures}/${need}枚`);
  if ((page.pictograms || []).length !== 4) bad.push('pictograms≠4');
  if ((page.sources || []).length < 1) bad.push('sourcesなし');
  if ((page.faqs || []).length < 2) bad.push('faqs<2');
  if (bad.length) { rejected.push(`${slug}: ${bad.join(' / ')}`); continue; }
  ready.set(slug, page);
}

// 全記事横断の重複文チェック。validate は同一文が11記事以上でエラーにする。
// facets（ハブの絞り込みタグ）は執筆エージェントの出力対象に含めていないため、
// 元ページの値を必ず引き継ぐ。取り込み後に消えるとハブの絞り込みが壊れる。
const merged = dataset.pages.map((p) => {
  const rebuilt = ready.get(p.slug);
  if (!rebuilt) return p;
  return p.facets && !rebuilt.facets ? { ...rebuilt, facets: p.facets } : rebuilt;
});
const sentenceOwners = new Map();
for (const page of merged) {
  const texts = [page.lead, ...(page.sections || []).flatMap((s) => [s.intro, ...(s.paragraphs || [])])].filter(Boolean);
  const seen = new Set();
  for (const text of texts) {
    for (const raw of String(text).split(/(?<=。)/)) {
      const sentence = raw.trim();
      if (sentence.length < 25 || seen.has(sentence)) continue;
      seen.add(sentence);
      if (!sentenceOwners.has(sentence)) sentenceOwners.set(sentence, []);
      sentenceOwners.get(sentence).push(page.slug);
    }
  }
}
const overused = [...sentenceOwners.entries()].filter(([, owners]) => owners.length >= 8);

console.log(`作り直し済み ${files.length}件 / 取り込み可 ${ready.size}件 / 見送り ${rejected.length}件`);
if (rejected.length) {
  console.log('\n見送り:');
  for (const line of rejected) console.log(`  - ${line}`);
}
if (overused.length) {
  console.log(`\n⚠ 8記事以上で使われている同一文 ${overused.length}件（11記事以上でvalidateがエラーにします）:`);
  for (const [sentence, owners] of overused.slice(0, 12)) {
    console.log(`  [${owners.length}記事] ${sentence.slice(0, 56)}`);
  }
}

const newSpec = merged.filter((p) => (p.sections || []).length <= SPEC.maxSections).length;
console.log(`\n取り込み後の新仕様適合: ${newSpec} / ${merged.length}件`);

if (dry) { console.log('\n--dry のため書き込みませんでした'); process.exit(0); }
if (!ready.size) { console.log('\n取り込むものがありません'); process.exit(0); }

dataset.pages = merged;
fs.writeFileSync(dataFile, JSON.stringify(dataset, null, 2));
console.log(`\n${dataFile} を更新しました`);
