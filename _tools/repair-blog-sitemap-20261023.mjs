// Scoped repair for four registrations verified absent from source and live on 2026-10-23.
// Do not infer replacements or remove any other URL. Existing article dates stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const missingSlugs = [
  '20261010-akiya-diy-chintai-3conditions',
  '20261010-fukuroi-akiya-sodan-1017',
  '20261010-iryubun-jikka-baikyaku-3checks',
  '20261010-iyakukin-joto-hiyo-2contracts',
];
export function repairBlogSitemap(source, root) {
  // Complete preflight before returning any output; a subsequently restored article must stop repair.
  for (const slug of missingSlugs) {
    if (fs.existsSync(path.join(root, 'blog', slug, 'index.html'))) {
      throw new Error(`Article now exists; review before removing registration: ${slug}`);
    }
    const loc = `<loc>https://fudosan.atawi.link/blog/${slug}/</loc>`;
    if (source.split(loc).length > 2) throw new Error(`Duplicate registration: ${slug}`);
  }
  let output = source;
  for (const slug of missingSlugs) {
    const entry = `  <url><loc>https://fudosan.atawi.link/blog/${slug}/</loc><lastmod>2026-10-10</lastmod></url>\n`;
    const loc = `<loc>https://fudosan.atawi.link/blog/${slug}/</loc>`;
    if (output.includes(loc) && !output.includes(entry)) throw new Error(`Registration changed; review: ${slug}`);
    output = output.replace(entry, '');
  }
  return output;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.join(root, 'sitemap-blog.xml');
  const before = fs.readFileSync(target, 'utf8');
  const after = repairBlogSitemap(before, root);
  if (after !== before) fs.writeFileSync(target, after);
  console.log(after === before ? 'No change: scoped repair already applied.' : 'Removed only the four verified missing blog registrations.');
}
