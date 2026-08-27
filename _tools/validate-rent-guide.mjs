import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'rent-guide-data/pages.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'rent-guide-data/manifest.json'), 'utf8'));
const strictAssets = process.argv.includes('--strict-assets');
const pagesBySlug = new Map(data.pages.map((page) => [page.slug, page]));
const errors = [];
const stats = [];
const crossSentences = new Map();

const decode = (text) => text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const visible = (html) => decode(html
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, ' '));
const compact = (text) => text.replace(/\s/gu, '');
const count = (text, needle) => needle ? text.split(needle).length - 1 : 0;
const fail = (slug, message) => errors.push(`${slug}: ${message}`);

for (const slug of manifest.slugs) {
  const page = pagesBySlug.get(slug);
  if (!page) { fail(slug, 'data missing'); continue; }
  const file = path.join(root, manifest.output_root, slug, 'index.html');
  if (!fs.existsSync(file)) { fail(slug, 'index.html missing'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const text = visible(html);
  const charCount = compact(text).length;
  stats.push({slug, chars:charCount});
  if (charCount < 10500) fail(slug, `visible non-space chars ${charCount} < 10500`);
  if (!html.includes(`<link rel="canonical" href="https://fudosan.atawi.link/rent/column/${slug}/">`)) fail(slug, 'canonical mismatch');
  if (count(html, '<h1>') !== 1) fail(slug, 'h1 count is not 1');
  if (count(html, 'class="article-section"') !== 14) fail(slug, 'chapter count is not 14');
  if (count(html, 'class="picto-card"') !== 4) fail(slug, 'pictogram cards count is not 4');
  for (let i = 1; i <= 4; i++) if (!html.includes(`./images/pictogram-0${i}.svg`)) fail(slug, `pictogram-0${i}.svg ref missing`);
  if (!html.includes('./images/hero.webp')) fail(slug, 'hero ref missing');
  if (count(html, 'class="faq-item"') !== 5) fail(slug, 'FAQ visible count is not 5');
  const checklistMatch = html.match(/<ol class="guide-checklist">([\s\S]*?)<\/ol>/);
  if (!checklistMatch || count(checklistMatch[1], '<li>') !== 12) fail(slug, 'checklist count is not 12');
  if (count(html, '<aside class="cta">') !== 1) fail(slug, 'CTA count is not 1');
  if (count(html, 'class="disc"') !== 1) fail(slug, 'disclaimer count is not 1');
  if (!html.includes('class="reviewer-card"') || !html.includes('/jikka-guide/assets/reviewer-oishi.jpg')) fail(slug, 'reviewer card or image missing');
  if (!html.includes('"reviewedBy"') || !html.includes('https://oishi-hiroyuki.org/')) fail(slug, 'reviewedBy missing');
  if (count(html, '"@type":"Article"') !== 1 || count(html, '"@type":"FAQPage"') !== 1 || count(html, '"@type":"BreadcrumbList"') !== 1) fail(slug, 'required JSON-LD type count mismatch');
  if ((html.match(/<section class="sources-section">[\s\S]*?<\/section>/) || [''])[0].split('<a href=').length - 1 < page.official_primary_sources.length) fail(slug, 'official source links missing');
  if (/「「|」」|相談の焦点|今回の確認目的|この確認テーマ|関連項目|確認する内容：/u.test(text)) fail(slug, 'placeholder or doubled quote found');

  const sections = [...html.matchAll(/<section class="article-section"[^>]*>([\s\S]*?)<\/section>/g)];
  sections.forEach((match, i) => {
    const sectionText = compact(visible(match[1]));
    const chapter = page.chapters[i];
    if (count(sectionText, compact(chapter.heading)) > 2) fail(slug, `chapter ${i + 1} heading repeated`);
    for (const [name, value] of Object.entries({objective:chapter.objective, example:chapter.example, caution:chapter.caution, action:chapter.action})) {
      if (count(sectionText, compact(value)) !== 1) fail(slug, `chapter ${i + 1} ${name} occurrence is not 1`);
    }
    const sentences = visible(match[1]).split(/[。！？]/u).map((sentence) => compact(sentence)).filter((sentence) => sentence.length >= 28);
    for (const sentence of new Set(sentences)) {
      if (!crossSentences.has(sentence)) crossSentences.set(sentence, new Set());
      crossSentences.get(sentence).add(slug);
    }
  });
  if (strictAssets) {
    for (const name of ['hero.webp','pictogram-01.svg','pictogram-02.svg','pictogram-03.svg','pictogram-04.svg']) {
      if (!fs.existsSync(path.join(root, manifest.output_root, slug, 'images', name))) fail(slug, `asset missing: images/${name}`);
    }
  }
}

for (const [sentence, slugs] of crossSentences) {
  if (slugs.size >= 5) errors.push(`cross-page repeated sentence (${slugs.size} pages): ${sentence.slice(0, 90)}`);
}

const hub = fs.readFileSync(path.join(root, manifest.hub_path), 'utf8');
if (!hub.includes('"numberOfItems":24')) errors.push('hub: ItemList numberOfItems is not 24');
if ((hub.match(/"@type":"ListItem"/g) || []).length !== 24) errors.push('hub: ListItem count is not 24');
if ((hub.match(/<a class="card" href="\/rent\/column\//g) || []).length !== 24) errors.push('hub: article card count is not 24');
for (const slug of manifest.slugs) if (!hub.includes(`/rent/column/${slug}/`)) errors.push(`hub: ${slug} missing`);
const sitemap = fs.readFileSync(path.join(root, manifest.sitemap_path), 'utf8');
for (const slug of manifest.slugs) if (count(sitemap, `<loc>https://fudosan.atawi.link/rent/column/${slug}/</loc>`) !== 1) errors.push(`sitemap: ${slug} count mismatch`);

const values = stats.map((row) => row.chars);
const min = Math.min(...values), max = Math.max(...values), avg = Math.round(values.reduce((a,b) => a + b, 0) / values.length);
console.log(`pages=${stats.length} min=${min} max=${max} avg=${avg} strictAssets=${strictAssets}`);
if (errors.length) {
  console.error(`errors=${errors.length}`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('errors=0');
