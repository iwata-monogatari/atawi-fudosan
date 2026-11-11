import fs from 'node:fs';

export const karteServicePolicy = JSON.parse(fs.readFileSync(new URL('../data/karte-service-policy.json', import.meta.url), 'utf8'));

// Synchronize the pricing label only. Never rebuild article bodies or address guidance.
export function refreshKartePricing(html) {
  const label = karteServicePolicy.copy.shortPricing;
  if (html.includes('筆数が多い場合は追加の実費が生じることがあるため、先に筆数をお伝えください。')) {
    html = html.replace(/"dateModified":"[^"T]+T/, '"dateModified":"2026-11-11T');
  }
  return html.replace(/(<p class="guide-cta__eyebrow">)(?:標準分0円｜売却営業なし|当社サービスは基本全額無料｜当社からの請求は仲介手数料のみ)(<\/p>)/g,
    (_, open, close) => open + label + close)
    .replaceAll('筆数が多い場合は追加の実費が生じることがあるため、先に筆数をお伝えください。',
      '筆数が多い場合も、必要な資料の取得実費は当社が負担します。確認する物件を特定するため、先に筆数をお伝えください。');
}
