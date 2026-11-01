// Presence/format check only: this does not verify a property against a registry.
export const addressMessage = '物件を特定して調査するため、町名に続く番地・地番まで入力してください（例：5789番地1）。不明な場合は固定資産税の課税明細書や登記書類でご確認ください。';

function normalize(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/[‐‑‒–—―ー−]/g, '-') : '';
}

export function detailValid(value) {
  const text = normalize(value);
  if (!text || text.length > 200 || /不明|未定|わから|分から|わかりません|分かりません|[○●?？]|省略/.test(text)) return false;
  if (/丁目(?!\s*[0-9〇零一二三四五六七八九十百千万])|[-の]\s*$/.test(text)) return false;
  if (/^(?:無番地|番外地)$/.test(text)) return true;
  return /^(?:[甲乙丙丁])?(?:[0-9]+|[〇零一二三四五六七八九十百千万]+(?:丁目|番地?|号))/.test(text);
}

export function addressValid(value) {
  const text = normalize(value).replace(/^〒?\d{3}-?\d{4}\s*/, '').replace(/^静岡県\s*/, '');
  if (!text || text.length > 400 || /不明|未定|わから|分から|わかりません|分かりません|[○●?？]/.test(text)) return false;
  // Strip the municipality before looking for a town followed by a lot number.
  const match = /^(?:浜松市(?:中央区|浜名区|天竜区)?|周智郡森町|[^\s]+?[市町村])\s*(.+)$/.exec(text);
  if (!match) return false;
  const rest = match[1];
  const parts = /^([^0-9\s]+?)\s*((?:[甲乙丙丁])?[0-9].*|[〇零一二三四五六七八九十百千万]+(?:丁目|番).*|無番地|番外地)$/.exec(rest);
  return !!parts && detailValid(parts[2]);
}
