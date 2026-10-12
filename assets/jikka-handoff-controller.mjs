// Each optional attachment owns one storage key and one form section.
export function mountHandoff({ prefix, key, flag, label, read, format, trackSuccess }) {
  const $ = suffix => document.getElementById(prefix + suffix);
  const section = $(''), preview = $('Preview'), include = $('Include'), status = $('Status');
  if (!section) return { beforeSubmit: () => undefined, success() {} };
  status.tabIndex = -1;
  const requested = new URLSearchParams(location.search).get(flag) === '1';
  let original = null, memo = null, timer = null, reviewRequired = false;
  const add = document.createElement('button'); add.type = 'button'; add.textContent = '保存中の' + label + 'を確認して追加'; add.hidden = true; status.after(add);
  const reasonText = {
    missing: '引継ぎ用の' + label + 'が見つかりません。通常の相談として入力できます。',
    expired: label + 'の引継ぎから30分が過ぎたため、添付を外しました。通常の相談として入力するか、ツールからもう一度引き継いでください。',
    invalid: label + 'を読み込めなかったため、添付を外しました。通常の相談として入力できます。'
  };
  function setFlag(on) { const url = new URL(location.href); if (on) url.searchParams.set(flag, '1'); else url.searchParams.delete(flag); history.replaceState(null, '', url.pathname + url.search + url.hash); }
  function clearStorage() { try { sessionStorage.removeItem(key); } catch (_) {} }
  function disable(text, needsReview = false) {
    reviewRequired ||= needsReview; clearStorage(); memo = null; original = null;
    if (timer) clearTimeout(timer);
    include.checked = false; include.disabled = true; preview.textContent = ''; preview.hidden = true; add.hidden = true;
    section.hidden = false; status.textContent = text; setFlag(false);
  }
  function verify() {
    let raw; try { raw = sessionStorage.getItem(key); } catch (_) { return { ok: false, reason: 'invalid' }; }
    if (original && original !== raw) return { ok: false, reason: 'invalid' }; return read(raw);
  }
  function checkExpiry() { if (!memo) return; const value = verify(); if (!value.ok) disable(reasonText[value.reason], include.checked); }
  function prefill() {
    const city = document.getElementById('city'), town = document.getElementById('town');
    if (city && !city.value && ['磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市'].includes(memo.property.city)) window.selectCity?.(memo.property.city, 'area');
    if (town && !town.value) town.value = memo.property.town;
  }
  function reveal(selected) {
    preview.textContent = format(memo); preview.hidden = false; section.hidden = false; add.hidden = true; include.disabled = false; include.checked = selected;
    status.textContent = '内容を確認し、' + label + 'を添えるか選んでください。市町・町名はフォームでもご確認ください。引継ぎは30分間有効です。';
    if (selected) prefill();
  }
  let raw; try { raw = sessionStorage.getItem(key); } catch (_) {}
  const checked = read(raw);
  if (checked.ok) {
    original = raw; memo = checked.memo; timer = setTimeout(checkExpiry, Math.max(0, checked.expiresAt - Date.now()));
    if (requested) reveal(true);
    else { section.hidden = false; preview.hidden = true; include.checked = false; include.disabled = true; add.hidden = false; status.textContent = 'このタブに有効な' + label + 'が一時保存されています。追加する前に全文を確認できます。'; }
  } else if (requested) disable(reasonText[checked.reason]); else if (raw) clearStorage();
  add.addEventListener('click', () => { const value = verify(); if (!value.ok) { disable(reasonText[value.reason]); return; } reveal(false); preview.focus(); });
  include.addEventListener('change', () => {
    if (!include.checked) { disable(label + 'の添付を外し、一時保存を消去しました。'); reviewRequired = false; }
    else { const value = verify(); if (!value.ok) disable(reasonText[value.reason], true); else { setFlag(true); prefill(); } }
  });
  $('Remove').addEventListener('click', () => { disable(label + 'の添付を外し、一時保存を消去しました。'); reviewRequired = false; });
  window.addEventListener('pageshow', checkExpiry); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiry(); });
  return {
    beforeSubmit() {
      if (reviewRequired) { reviewRequired = false; status.focus(); throw new Error('attachment_review'); }
      if (!include.checked) return undefined;
      const value = verify(); if (!value.ok) { disable(reasonText[value.reason]); throw new Error('attachment_review'); } return value.memo;
    },
    success(attached) { if (!attached) return; try { trackSuccess(attached); } catch (_) {} clearStorage(); if (timer) clearTimeout(timer); memo = null; }
  };
}
