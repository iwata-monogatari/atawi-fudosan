import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbidden = [
  ['浜松市の' + '一部', '旧対応地域'],
  ['9:00〜' + '17:00', '旧営業時間'],
  ['9〜' + '17時', '旧営業時間'],
  ['9:00から' + '17:00', '旧営業時間'],
  ['定休日' + 'なし', '旧定休日'],
];
const extensions = /\.(?:html|js|mjs|txt)$/;
const errors = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules'].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (extensions.test(name) && !path.endsWith('check-public-facts.mjs')) inspect(path);
  }
}

function inspect(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [text, label] of forbidden) {
      if (line.includes(text)) errors.push(`${path}:${index + 1} ${label}: ${text}`);
    }
  });
}

walk('.');

for (const path of ['index.html', 'karte/index.html']) {
  const html = readFileSync(path, 'utf8');
  for (const area of ['磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市']) {
    if (!html.includes(`"${area}"`)) errors.push(`${path}: schema areaServed is missing ${area}`);
  }
  if (!html.includes('"closes":"18:00"')) errors.push(`${path}: schema closing time is not 18:00`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Public company facts are consistent.');
