#!/usr/bin/env node
/*
 * 新規記事のピクトグラム4枚 (fact/risk/action/choice) をSVGで生成する。
 *
 * tools/visuals/generate-pictograms.mjs の renderSvg() は元々「既存100記事」に
 * 固定された検証(adapt())を経由する前提だったが、renderSvg() 自体はページ数を
 * 見ないので、新規記事にも直接呼べる。ここではその検証をバイパスし、
 * jikka-guide/data/rebuilt/<slug>.json の pictogramPlan を読んで直接描画する。
 *
 *   node _tools/generate-new-pictograms.mjs <slug> [<slug> ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSvg, BACKGROUNDS } from '../tools/visuals/generate-pictograms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROLE_STYLE = {
  fact: { badge: 'search', background: 'sky' },
  risk: { badge: 'attention', background: 'yellow-soft' },
  action: { badge: 'step-1', background: 'paper' },
  choice: { badge: 'pause-ok', background: 'sky-2' }
};

const slugs = process.argv.slice(2);
if (!slugs.length) {
  console.error('使い方: node _tools/generate-new-pictograms.mjs <slug> [<slug> ...]');
  process.exit(1);
}

for (const slug of slugs) {
  const file = path.join(root, 'jikka-guide/data/rebuilt', `${slug}.json`);
  if (!fs.existsSync(file)) { console.error(`✗ ${slug}: rebuilt JSONがありません`); continue; }
  const page = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plan = page.pictogramPlan;
  if (!Array.isArray(plan) || plan.length !== 4) {
    console.error(`✗ ${slug}: pictogramPlan が4件ありません（見つかった: ${plan?.length ?? 0}）`);
    continue;
  }
  const outDir = path.join(root, 'assets/visuals/pictograms', slug);
  fs.mkdirSync(outDir, { recursive: true });
  const pictograms = [];
  plan.forEach((item, index) => {
    const role = ['fact', 'risk', 'action', 'choice'][index];
    const style = ROLE_STYLE[role];
    const icon = { role, primary: item.primary, secondary: item.secondary, badge: style.badge, background: style.background, alt: item.alt };
    const svg = renderSvg({ page_id: slug }, icon);
    const filename = `${String(index + 1).padStart(2, '0')}-${role}.svg`;
    fs.writeFileSync(path.join(outDir, filename), svg, 'utf8');
    pictograms.push({
      src: `/assets/visuals/pictograms/${slug}/${filename}`,
      alt: item.alt,
      title: item.title,
      body: item.body
    });
  });
  page.pictograms = pictograms;
  delete page.pictogramPlan;
  fs.writeFileSync(file, JSON.stringify(page, null, 1));
  console.log(`✓ ${slug}: ピクトグラム4枚を生成`);
}
