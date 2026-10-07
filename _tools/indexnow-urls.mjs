/** Map changed source files to public URLs without submitting a notification. */
export function publicUrlForFile(file, html, origin) {
  const normalized = file.replaceAll('\\', '/');
  let fallback = null;
  if (normalized === 'index.html') fallback = `${origin}/`;
  else if (normalized.endsWith('/index.html')) fallback = `${origin}/${normalized.slice(0, -'index.html'.length)}`;
  else if (normalized.endsWith('.html')) fallback = `${origin}/${normalized}`;
  else if (normalized === 'llms.txt') return `${origin}/llms.txt`;
  else return null;

  // Flat .html files may be served at extensionless URLs by Cloudflare Pages.
  // Use the page's declared canonical only when it is a plain same-site URL.
  const tag = html?.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
  const href = tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!href) return fallback;
  try {
    const url = new URL(href, `${origin}/`);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

export function changedPublicUrls(files, sitemapUrls, { origin, readHtml }) {
  // A canonical is never permission to notify an unlisted page or other site.
  const allowed = new Set([...sitemapUrls, `${origin}/llms.txt`]);
  return [...new Set(files.map(file => publicUrlForFile(
    file,
    file.endsWith('.html') ? readHtml(file) : '',
    origin,
  )).filter(url => url && allowed.has(url)))];
}
