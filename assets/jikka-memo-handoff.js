import { HANDOFF_KEY, readHandoff, formatMemoText } from './jikka-memo-core.mjs?v=20261012';

const section = document.getElementById('memoHandoff');
const preview = document.getElementById('memoHandoffPreview');
const include = document.getElementById('memoHandoffInclude');
const status = document.getElementById('memoHandoffStatus');
const requested = new URLSearchParams(location.search).get('memo') === '1';
let original = null, memo = null, expiresAt = 0, timer = null;
function clearStorage() { try { sessionStorage.removeItem(HANDOFF_KEY); } catch (_) {} }
function disable(text) {
  clearStorage(); memo = null; original = null; expiresAt = 0;
  if (timer) clearTimeout(timer);
  include.checked = false; include.disabled = true; preview.textContent = ''; preview.hidden = true;
  section.hidden = false; status.textContent = text;
}
const reasons = {
  missing: '引継ぎ用の比較メモが見つかりません。通常の相談として入力できます。',
  expired: '比較メモの引継ぎから30分が過ぎたため、添付を外しました。通常の相談として入力するか、ツールからもう一度引き継いでください。',
  invalid: '比較メモを読み込めなかったため、添付を外しました。通常の相談として入力できます。'
};
function verify() {
  let raw;
  try { raw = sessionStorage.getItem(HANDOFF_KEY); } catch (_) { return { ok: false, reason: 'invalid' }; }
  if (original && raw !== original) return { ok: false, reason: 'invalid' };
  return readHandoff(raw);
}
function checkExpiry() {
  if (!memo) return;
  const check = verify();
  if (!check.ok) disable(reasons[check.reason]);
}

window.jikkaMemoHandoff = {
  beforeSubmit() {
    if (!include.checked) return undefined;
    const check = verify();
    if (!check.ok) { disable(reasons[check.reason]); throw new Error('memo_invalid'); }
    return check.memo;
  },
  success(attachedMemo) {
    if (attachedMemo) {
      window.fgaMeasurement?.track('jikka_memo_application_success', { tool: 'jikka-memo-v1', step: '4', entry: window.jikkaSpecial?.submission().entry || 'memo', concern: attachedMemo.property.concern });
    }
    clearStorage();
    if (timer) clearTimeout(timer);
    memo = null;
  }
};
if (requested) {
  let raw;
  try { raw = sessionStorage.getItem(HANDOFF_KEY); } catch (_) {}
  const checked = readHandoff(raw);
  if (checked.ok) {
    original = raw; memo = checked.memo; expiresAt = checked.expiresAt;
    preview.textContent = formatMemoText(memo); preview.hidden = false; section.hidden = false;
    include.checked = true; include.disabled = false;
    status.textContent = 'この比較メモを任意で添えて送れます。内容を確認し、物件の市町・町名は下のフォームでもご確認ください。引継ぎは30分間有効です。';
    // Prefill only values already explicitly supplied; the standard form still validates them.
    if (!document.getElementById('city').value && ['磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市'].includes(memo.property.city)) {
      window.selectCity?.(memo.property.city, 'area');
    }
    if (!document.getElementById('town').value) document.getElementById('town').value = memo.property.town;
    timer = setTimeout(checkExpiry, Math.max(0, expiresAt - Date.now()));
  } else disable(reasons[checked.reason]);
} else clearStorage();
include.addEventListener('change', () => {
  if (!include.checked) disable('比較メモの添付を外し、一時保存を消去しました。通常の相談として送信できます。');
});
document.getElementById('memoHandoffRemove').addEventListener('click', () => disable('比較メモの添付を外し、一時保存を消去しました。通常の相談として送信できます。'));
window.addEventListener('pageshow', checkExpiry);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiry(); });
