import { readFileSync, writeFileSync } from 'node:fs';
import { propertyAddressHelp } from './property-address-help.mjs';
const root = new URL('../', import.meta.url);
const pages = JSON.parse(readFileSync(new URL('lp/content.json', root), 'utf8'));
const files = ['index.html', 'karte/index.html', 'from-temple/index.html', 'from-shrine/index.html', 'kaigo-jikka/index.html', 'rent/index.html', ...pages.map(p => `lp/${p.slug}/index.html`)];
// Prepare and validate all replacements before writing any file.
const updates = files.map(file => {
  const url = new URL(file, root), source = readFileSync(url, 'utf8');
  const pattern = /(<p\b[^>]*\bid="(?:addressDetailHelp|propertyAddressHelp|lpAddressHelp)"[^>]*>)[\s\S]*?<\/p>/g;
  if ([...source.matchAll(pattern)].length !== 1) throw new Error(`${file}: address help target is missing or ambiguous`);
  return { url, source, next: source.replace(pattern, (_, start) => start + propertyAddressHelp + '</p>') };
});
for (const { url, source, next } of updates) if (source !== next) writeFileSync(url, next);
console.log(`Address document guidance synchronized: ${files.length} forms.`);
