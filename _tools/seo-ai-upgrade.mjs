import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteOrigin = 'https://fudosan.atawi.link';
const today = '2026-07-23';

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), value.replace(/\r?\n/g, '\n'), 'utf8');
}

function decodeJsString(value) {
  return value
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function firstString(source, key) {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*'((?:\\\\.|[^'])*)'`));
  if (!match) throw new Error(`DIAG.${key} was not found`);
  return decodeJsString(match[1]);
}

function stringArray(source, key) {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/'((?:\\.|[^'])*)'/g)].map((item) => decodeJsString(item[1]));
}

function listMarkup(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function addAiReferralScript(source) {
  if (source.includes('/assets/ai-referral.js')) return source;
  const aiScript = '<script defer src="/assets/ai-referral.js?v=20260723"></script>';
  const trackerPattern =
    /(<script defer src="https:\/\/fujigaoka-analytics-worker\.hiroyukio0122\.workers\.dev\/tracker\.js"[^>]*><\/script>)/;
  if (trackerPattern.test(source)) return source.replace(trackerPattern, `${aiScript}\n$1`);
  return source.replace(
    '</body>',
    `${aiScript}\n<script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script>\n</body>`,
  );
}

const diagnosisDir = path.join(root, 'shindan');
const diagnosisFiles = fs
  .readdirSync(diagnosisDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(diagnosisDir, entry.name, 'index.html')))
  .map((entry) => `shindan/${entry.name}/index.html`)
  .filter((relativePath) => read(relativePath).includes('window.DIAG ='));

for (const relativePath of diagnosisFiles) {
  let source = read(relativePath);
  const config = source.slice(source.indexOf('window.DIAG ='));
  const title = firstString(config, 'title');
  const lead = firstString(config, 'lead');
  const badge = firstString(config, 'badge');
  const forWhom = stringArray(config, 'forWhom');
  const reveals = stringArray(config, 'reveals');
  const questionSection = config.match(/\bquestions\s*:\s*\[([\s\S]*?)\],\s*result\s*:/);
  const questionCount = questionSection ? (questionSection[1].match(/\{\s*id\s*:/g) || []).length : 0;

  const staticIntro = [
    '<div id="diag-root">',
    '<!-- SEO_STATIC_DIAG_START: JavaScript非実行の検索・AIクローラー向け初期本文 -->',
    '<div class="intro">',
    '<div class="intro-hero">',
    `<span class="badge">${escapeHtml(badge)}</span>`,
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="lead">${escapeHtml(lead)}</p>`,
    '</div>',
    '<div class="intro-cols">',
    '<section class="box" aria-labelledby="static-for-whom">',
    '<h3 id="static-for-whom"><span class="ic" aria-hidden="true">🙋</span>こんな方におすすめ</h3>',
    `<ul>${listMarkup(forWhom)}</ul>`,
    '</section>',
    '<section class="box reveal" aria-labelledby="static-reveals">',
    '<h3 id="static-reveals"><span class="ic" aria-hidden="true">🔎</span>この診断でわかること</h3>',
    `<ul>${listMarkup(reveals)}</ul>`,
    '</section>',
    '</div>',
    '<div class="start-wrap">',
    `<p class="start-note">全${questionCount || 6}問の無料診断です。JavaScriptが有効な環境では、この位置に「診断を始める」ボタンが表示されます。登録は不要です。</p>`,
    '<noscript><p class="start-note">診断の実行にはJavaScriptが必要です。実家の状況を個別に整理したい方は、<a href="/karte/">ふじがおか実家カルテのお申込み</a>もご利用いただけます。</p></noscript>',
    '</div>',
    '</div>',
    '<!-- SEO_STATIC_DIAG_END -->',
    '</div>',
  ].join('');

  const staticPattern = /<div id="diag-root">[\s\S]*?<!-- SEO_STATIC_DIAG_END -->\s*<\/div>/;
  if (staticPattern.test(source)) {
    source = source.replace(staticPattern, staticIntro);
  } else {
    source = source.replace('<div id="diag-root"></div>', staticIntro);
  }

  source = addAiReferralScript(source);
  write(relativePath, source);
}

const initialSitemap = read('sitemap.xml');
const aiTrackingFiles = new Set();
for (const match of initialSitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) {
  const htmlPath = localHtmlForUrl(match[1]);
  if (!htmlPath.endsWith('.html') || !fs.existsSync(htmlPath)) continue;
  const relativePath = path.relative(root, htmlPath).replace(/\\/g, '/');
  const source = read(relativePath);
  if (/<meta[^>]+content=["'][^"']*noindex/i.test(source)) continue;
  write(relativePath, addAiReferralScript(source));
  aiTrackingFiles.add(relativePath);
}

const voiceTitleFixes = new Map([
  ['voices/voice-02/index.html', 'VOICE 02'],
  ['voices/voice-23/index.html', 'VOICE 23'],
  ['voices/voice-07/index.html', 'VOICE 07'],
  ['voices/voice-08/index.html', 'VOICE 08'],
  ['voices/voice-14/index.html', 'VOICE 14'],
  ['voices/voice-25/index.html', 'VOICE 25'],
]);

for (const [relativePath, suffix] of voiceTitleFixes) {
  let source = read(relativePath);
  source = source.replace(
    /<title>([^<]+)<\/title>/,
    (match, title) => `<title>${title.replace(/｜VOICE \d+$/, '')}｜${suffix}</title>`,
  );
  write(relativePath, source);
}

const organization = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  '@id': `${siteOrigin}/#organization`,
  name: '富士ヶ丘サービス株式会社',
  alternateName: 'ATAWI FUDOSAN',
  url: `${siteOrigin}/`,
  logo: `${siteOrigin}/karte/assets/img/logo.jpg`,
  image: `${siteOrigin}/og-image.png`,
  telephone: '0538-31-3308',
  email: 'fudosan@fujigaoka-service.co.jp',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '見付5789番地1',
    addressLocality: '磐田市',
    addressRegion: '静岡県',
    addressCountry: 'JP',
  },
  areaServed: ['磐田市', '袋井市', '掛川市', '森町', '浜松市の一部'],
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '09:00',
    closes: '17:00',
  },
  employee: {
    '@type': 'Person',
    '@id': `${siteOrigin}/#hiro-yuki-oishi`,
    name: '大石浩之',
    jobTitle: '代表取締役・宅地建物取引士',
    identifier: '静岡県知事 第027186号',
    worksFor: { '@id': `${siteOrigin}/#organization` },
  },
  sameAs: [
    'https://www.fujigaoka-service.co.jp/',
    'https://www.fujigaoka-service.info/',
    'https://oishi-hiroyuki.org/',
  ],
  description:
    '静岡県知事(2)第14083号。磐田市・袋井市・掛川市・森町・浜松市一部で実家じまい、相続不動産、ふじがおか実家カルテを扱う宅地建物取引業者。',
};

const service = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${siteOrigin}/karte/#service`,
  serviceType: 'ふじがおか実家カルテ',
  name: 'ふじがおか実家カルテ',
  provider: { '@id': `${siteOrigin}/#organization` },
  areaServed: ['磐田市', '袋井市', '掛川市', '森町', '浜松市の一部'],
  description:
    '住所から公開情報を確認し、実家や空き家の名義、権利、土地、道路、農地、災害情報などを60項目超の確認表から、その家に関係する項目だけ整理するサービス。査定ではなく価格は出ません。作成料はいただかず、2026年8月31日までの申込みは標準分の登記簿・公図など取得実費も当社負担です。追加実費が必要な場合は事前に案内します。',
  url: `${siteOrigin}/karte/`,
};

const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteOrigin}/#website`,
  url: `${siteOrigin}/`,
  name: 'ATAWI FUDOSAN',
  alternateName: 'ふじがおか実家カルテ',
  inLanguage: 'ja',
  publisher: { '@id': `${siteOrigin}/#organization` },
};

function replaceJsonLdByType(source, type, value) {
  const pattern = new RegExp(
    `<script type="application/ld\\+json">(?=[^<]*"@type":"${type}")[^<]*<\\/script>`,
  );
  if (!pattern.test(source)) throw new Error(`${type} JSON-LD block was not found`);
  return source.replace(pattern, `<script type="application/ld+json">${JSON.stringify(value)}</script>`);
}

for (const relativePath of ['index.html', 'karte/index.html']) {
  let source = read(relativePath);
  source = replaceJsonLdByType(source, 'RealEstateAgent', organization);
  source = replaceJsonLdByType(source, 'Service', service);
  if (relativePath === 'index.html' && !source.includes('"@id":"https://fudosan.atawi.link/#website"')) {
    const serviceBlock = `<script type="application/ld+json">${JSON.stringify(service)}</script>`;
    source = source.replace(
      serviceBlock,
      `${serviceBlock}\n<script type="application/ld+json">${JSON.stringify(website)}</script>`,
    );
  }
  write(relativePath, source);
}

function localHtmlForUrl(url) {
  const pathname = new URL(url).pathname;
  if (pathname === '/') return path.join(root, 'index.html');
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  return pathname.endsWith('/')
    ? path.join(root, relative, 'index.html')
    : path.join(root, relative);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match ? match[1] : '';
}

function pageImages(htmlPath) {
  if (!fs.existsSync(htmlPath) || !htmlPath.endsWith('.html')) return [];
  const source = fs.readFileSync(htmlPath, 'utf8');
  const images = [];

  for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
    const src = attribute(match[0], 'src');
    if (!src || !src.startsWith('/') || src.startsWith('//')) continue;
    if (/logo|favicon|icon-|apple-touch|badge/i.test(src)) continue;
    if (!/\.(?:avif|webp|png|jpe?g)(?:\?.*)?$/i.test(src)) continue;

    const cleanSrc = src.split('?')[0];
    if (!fs.existsSync(path.join(root, cleanSrc.replace(/^\/+/, '')))) continue;

    const absolute = new URL(src, siteOrigin).href;
    if (images.some((image) => image.url === absolute)) continue;
    images.push({
      url: absolute,
      title: attribute(match[0], 'alt') || path.basename(cleanSrc),
    });
    if (images.length === 3) break;
  }
  return images;
}

let sitemap = read('sitemap.xml');
const urlEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
  const locMatch = match[1].match(/<loc>([^<]+)<\/loc>/);
  const lastmodMatch = match[1].match(/<lastmod>([^<]+)<\/lastmod>/);
  if (!locMatch) throw new Error('Sitemap entry has no loc');
  const url = locMatch[1];
  const urlPath = new URL(url).pathname;
  const updated =
    urlPath === '/' ||
    urlPath === '/karte/' ||
    urlPath.startsWith('/shindan/') ||
    [...voiceTitleFixes.keys()].some((relativePath) => `/${relativePath.replace(/index\.html$/, '')}` === urlPath);
  const lastmod = updated ? today : lastmodMatch?.[1];
  const imageMarkup = pageImages(localHtmlForUrl(url))
    .map(
      (image) =>
        `<image:image><image:loc>${escapeXml(image.url)}</image:loc><image:title>${escapeXml(image.title)}</image:title></image:image>`,
    )
    .join('');
  return `  <url><loc>${escapeXml(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${imageMarkup}</url>`;
});

sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ...urlEntries,
  '</urlset>',
  '',
].join('\n');
write('sitemap.xml', sitemap);

console.log(
  JSON.stringify(
    {
      diagnosisStaticPages: diagnosisFiles.length,
      aiTrackedLandingPages: aiTrackingFiles.size,
      uniqueVoiceTitlesFixed: voiceTitleFixes.size,
      entityPagesUpdated: 2,
      sitemapUrls: urlEntries.length,
      sitemapImages: (sitemap.match(/<image:image>/g) || []).length,
    },
    null,
    2,
  ),
);
