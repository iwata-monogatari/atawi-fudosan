import { VISIT_KEY, MAX_FILE_BYTES, CITIES, STATUS, RECORD, PHASE, ACCESS, CONCERNS, ITEMS, createVisitMemo, validateVisitMemo, summarizeVisit, locationText, formatVisitText, japanDate, serializeVisitFile, readVisitFile } from './jikka-visit-core.mjs?v=20261012-visit';

const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const fieldMap = { 'property.city': 'visitCity', 'property.town': 'visitTown', 'visit.phase': 'visitPhase', 'visit.plannedOn': 'visitPlannedOn', 'visit.checkedOn': 'visitCheckedOn', 'visit.indoorAccess': 'visitAccess', 'visit.concerns': 'visitConcerns', question: 'visitQuestion' };
const allowedEntries = ['visit-memo', 'memo', 'special', 'hikaku', 'faraway-management', 'after-care-facility', 'garden-leak-neighbor', 'leftover-items', 'demolition-or-old-house', 'jikka', 'home', 'shindan', 'kaigo-jikka'];
const paramEntry = new URLSearchParams(location.search).get('entry');
const entry = allowedEntries.includes(paramEntry) ? paramEntry : 'visit-memo';
let currentStep = 1, result = null, pendingFile = null, started = false, seen = false, dirty = false;
function track(name, step = currentStep) { window.fgaMeasurement?.track(name, { tool: 'jikka-visit-v1', step: String(step), entry }); }
function markStart() { if (!started) { track('jikka_visit_start'); started = true; } }
function options(select, values) { for (const [value, label] of Object.entries(values)) { const o = el('option', label); o.value = value; select.append(o); } }
function error(input, text) {
  let message = $(input.id + 'Error');
  if (!message) { message = el('p', '', 'jv-error'); message.id = input.id + 'Error'; message.setAttribute('role', 'alert'); input.after(message); }
  message.textContent = text; message.hidden = !text;
  if (text) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', [input.dataset.description || '', message.id].filter(Boolean).join(' ')); }
  else { input.removeAttribute('aria-invalid'); if (input.dataset.description) input.setAttribute('aria-describedby', input.dataset.description); else input.removeAttribute('aria-describedby'); }
}
function clearErrors() { document.querySelectorAll('#visitForm [aria-invalid]').forEach(input => error(input, '')); }
function showErrors(errors, step) {
  clearErrors(); let first;
  for (const [key, text] of Object.entries(errors)) {
    const input = $(fieldMap[key]); if (!input || (step && !input.closest('[data-visit-step="' + step + '"]'))) continue;
    error(input, text); if (input.closest('details')) input.closest('details').open = true; first ||= input;
  }
  if (first) { first.focus(); return false; } return true;
}
function buildItems() {
  for (const group of ['屋外', '屋内', '資料']) {
    const details = el('details', undefined, 'jv-group'); details.open = true; details.dataset.group = group;
    details.append(el('summary', group + 'で確認すること'));
    if (group === '屋内') details.append(el('p', '入れない・危険を感じる場合は「今回は確認できない」を選べます。', 'jk-small'));
    const grid = el('div', undefined, 'jv-item-grid');
    for (const item of ITEMS.filter(row => row.group === group)) {
      const card = el('article', undefined, 'jv-card'); card.dataset.item = item.id; card.append(el('h3', item.label), el('p', item.guide));
      const focus = el('p', '選んだ気になる点に関連する項目です。', 'jv-focus'); focus.dataset.concern = item.concern; focus.hidden = true; card.append(focus);
      const fields = el('div', undefined, 'jv-card-fields');
      for (const [key, label, choices] of [['status', 'この項目の状態', STATUS], ['record', '手元の記録', RECORD]]) {
        const wrap = el('div'), lab = el('label', label), select = el('select'); select.id = 'visit_' + item.id + '_' + key; lab.htmlFor = select.id; options(select, choices); wrap.append(lab, select); fields.append(wrap); fieldMap['items.' + item.id + '.' + key] = select.id;
      }
      const wrap = el('div', undefined, 'jv-full'), lab = el('label', '短いメモ（任意・80文字まで）'), note = el('textarea');
      note.id = 'visit_' + item.id + '_note'; note.rows = 2; lab.htmlFor = note.id; wrap.append(lab, note); fields.append(wrap); fieldMap['items.' + item.id + '.note'] = note.id;
      card.append(fields); grid.append(card);
    }
    details.append(grid); $('visitItems').append(details);
  }
}
function collect() {
  const memo = createVisitMemo(); memo.property.city = $('visitCity').value; memo.property.town = $('visitTown').value;
  memo.visit.phase = $('visitPhase').value; memo.visit.indoorAccess = $('visitAccess').value;
  memo.visit.plannedOn = $('visitPlannedOn').value || null; memo.visit.checkedOn = $('visitCheckedOn').value || null;
  memo.visit.concerns = [...document.querySelectorAll('#visitConcerns input:checked')].map(input => input.value);
  for (const item of ITEMS) for (const key of ['status', 'record', 'note']) memo.items[item.id][key] = $('visit_' + item.id + '_' + key).value;
  memo.question = $('visitQuestion').value; return validateVisitMemo(memo);
}
function fill(memo) {
  for (const [key, id] of Object.entries(fieldMap)) {
    if (key === 'visit.concerns') continue;
    const parts = key.split('.'); let value = memo; for (const part of parts) value = value[part]; $(id).value = value ?? '';
  }
  document.querySelectorAll('#visitConcerns input').forEach(input => { input.checked = memo.visit.concerns.includes(input.value); }); highlight(); clearErrors();
}
function highlight() {
  const selected = [...document.querySelectorAll('#visitConcerns input:checked')].map(input => input.value);
  document.querySelectorAll('[data-concern]').forEach(p => { p.hidden = !selected.includes(p.dataset.concern); });
}
function showStep(step) {
  currentStep = step;
  document.querySelectorAll('[data-visit-step]').forEach(panel => { panel.hidden = Number(panel.dataset.visitStep) !== step; });
  document.querySelectorAll('[data-visit-progress]').forEach(n => { if (Number(n.dataset.visitProgress) === step) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current'); });
  const heading = document.querySelector('[data-visit-step="' + step + '"] h2'); heading.focus(); heading.scrollIntoView({ block: 'start', behavior: 'instant' });
}
function go(step) {
  if (step > currentStep) {
    const read = collect();
    if (!read.ok) {
      if (step === 3) { const input = $(fieldMap[Object.keys(read.errors)[0]]); showStep(Number(input?.closest('[data-visit-step]')?.dataset.visitStep || currentStep)); showErrors(read.errors); return; }
      if (!showErrors(read.errors, currentStep)) return;
    }
    if (step === 3 && read.ok) { result = read.memo; renderResult(); if (!seen) { track('jikka_visit_result_view', 3); seen = true; } }
  }
  showStep(step);
}
function paragraph(parent, text, cls) { parent.append(el('p', text, cls)); }
function renderResult() {
  const root = $('visitResultContent'); root.replaceChildren(); const summary = summarizeVisit(result);
  paragraph(root, locationText(result)); paragraph(root, PHASE[result.visit.phase] + ' ／ 訪問予定：' + (result.visit.plannedOn || '未定') + ' ／ 最後に確認した日：' + (result.visit.checkedOn || '未記入'));
  const counts = el('div', undefined, 'jv-counts');
  for (const [key, label] of Object.entries(STATUS)) { const p = el('p', label); p.append(el('strong', summary.counts[key] + '件')); counts.append(p); } root.append(counts);
  paragraph(root, '全12項目の記録です。建物の安全性や売却できるかは、物件ごとに確認します。', 'jk-small');
  for (const item of ITEMS) {
    const row = result.items[item.id], card = el('section', undefined, 'jv-result-item'); card.append(el('h3', item.label));
    paragraph(card, STATUS[row.status] + ' ／ ' + RECORD[row.record]); if (row.note) paragraph(card, row.note); root.append(card);
  }
  if (result.question) { root.append(el('h3', '全体の相談メモ')); paragraph(root, result.question); }
  root.append(el('h3', '次に確認したいこと')); const list = el('ol'); summary.actions.slice(0, 3).forEach(text => list.append(el('li', text))); root.append(list);
  if (summary.actions.length > 3) { const details = el('details'), rest = el('ul'); details.append(el('summary', 'ほか' + (summary.actions.length - 3) + '件を見る')); summary.actions.slice(3).forEach(text => rest.append(el('li', text))); details.append(rest); root.append(details); }
  paragraph(root, '「写真あり」は手元に写真があるという記録です。写真そのものはこのメモに含まれません。', 'jk-small');
  $('visitAttach').checked = false; $('visitConsult').disabled = true; $('visitHandoffError').hidden = true; $('visitExportStatus').hidden = true; renderPrint();
}
const compact = text => text.replace(/\s+/g, ' ').trim();
function renderPrint() {
  const sheet = $('visitPrintSheet'); sheet.replaceChildren(); const summary = summarizeVisit(result), front = el('section');
  paragraph(front, 'ATAWI FUDOSAN ／ 帰省に持っていく一覧'); front.append(el('h1', '実家の写真・現地確認メモ'));
  paragraph(front, '作成日：' + japanDate() + ' ／ ' + compact(locationText(result)));
  paragraph(front, '訪問予定：' + (result.visit.plannedOn || '未定') + ' ／ 最後に確認した日：' + (result.visit.checkedOn || '未記入'));
  paragraph(front, '状態の欄：確認不可＝今回は確認できない ／ 専門家へ＝専門家に聞きたい');
  const table = el('table'), head = el('thead'), headings = el('tr'); ['項目', '見ること・手元の記録', '状態'].forEach(text => headings.append(el('th', text))); head.append(headings); table.append(head);
  const body = el('tbody');
  for (const item of ITEMS) {
    const row = result.items[item.id], tr = el('tr'), description = el('td', item.short + ' ／ ' + RECORD[row.record]); description.append(el('span', '', 'jv-print-memo-line'));
    const choices = el('td', undefined, 'jv-print-choices');
    for (const pair of [[['unknown', '未確認'], ['checked', '確認済み']], [['unavailable', '確認不可'], ['ask', '専門家へ']]]) choices.append(el('div', pair.map(([key, label]) => (row.status === key ? '■ ' : '□ ') + label).join(' ／ ')));
    tr.append(el('th', item.label), description, choices); body.append(tr);
  }
  table.append(body); front.append(table);
  paragraph(front, '確認済みは利用者が見た記録です。危険を感じる場所へ入らず、見られる範囲で確認してください。写真は端末で保管し、鍵や口座情報は記入しないでください。', 'jv-print-note');
  paragraph(front, '相談：0538-31-3308 ／ fudosan.atawi.link/karte/'); sheet.append(front);
  if (result.question || ITEMS.some(item => result.items[item.id].note)) {
    const detail = el('section', undefined, 'jv-print-detail'); detail.append(el('h1', '記入した内容と次の確認事項')); paragraph(detail, compact(locationText(result)) + ' ／ 作成日：' + japanDate());
    const notes = el('div', undefined, 'jv-print-notes');
    for (const item of ITEMS) if (result.items[item.id].note) { const article = el('article'); article.append(el('h3', item.label)); paragraph(article, compact(result.items[item.id].note)); notes.append(article); }
    detail.append(notes);
    if (result.question) { detail.append(el('h2', '全体の相談メモ')); paragraph(detail, compact(result.question)); }
    detail.append(el('h2', '次に確認したいこと')); const list = el('ol'); summary.actions.forEach(text => list.append(el('li', text))); detail.append(list);
    paragraph(detail, '画像は含まれません。確認結果と専門家の判断を分けて相談しましょう。', 'jv-print-note'); sheet.append(detail);
  }
}
options($('visitCity'), Object.fromEntries(CITIES.map(value => [value, value === 'unknown' ? 'まだ分からない' : value]))); options($('visitPhase'), PHASE); options($('visitAccess'), ACCESS);
$('visitCheckedOn').max = japanDate();
for (const [key, label] of Object.entries(CONCERNS)) { const lab = el('label'), input = el('input'); input.type = 'checkbox'; input.value = key; lab.append(input, el('span', label)); $('visitConcernOptions').append(lab); }
$('visitConcerns').tabIndex = -1; buildItems();
document.querySelectorAll('#visitForm input,#visitForm select,#visitForm textarea').forEach(input => { input.dataset.description = input.getAttribute('aria-describedby') || ''; });
document.querySelectorAll('[data-visit-next]').forEach(button => button.addEventListener('click', () => go(Number(button.dataset.visitNext))));
document.querySelectorAll('[data-visit-back]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.visitBack))));
$('visitForm').addEventListener('submit', event => { event.preventDefault(); go(Math.min(3, currentStep + 1)); });
for (const type of ['input', 'change']) $('visitForm').addEventListener(type, () => { markStart(); dirty = true; highlight(); });
$('visitStart').disabled = false; $('visitFile').disabled = false;
$('visitStart').addEventListener('click', () => { $('visitIntro').hidden = true; $('visitApp').hidden = false; showStep(1); });
$('visitPrint').addEventListener('click', () => { if (result) { renderPrint(); track('jikka_visit_print_requested', 3); window.print(); } });
$('visitExport').addEventListener('click', () => {
  if (!result) return;
  let url;
  try {
    const raw = serializeVisitFile(result), blob = new Blob([raw], { type: 'application/json;charset=utf-8' }); url = URL.createObjectURL(blob);
    const link = el('a'); link.href = url; link.download = 'atawi-jikka-visit-' + japanDate().replace(/-/g, '') + '.json'; document.body.append(link); link.click(); link.remove();
    track('jikka_visit_export_requested', 3); $('visitExportStatus').textContent = '保存を要求しました。端末の保存先に編集用ファイルがあるか確認してください。写真は含まれません。';
  } catch (_) { $('visitExportStatus').textContent = 'この端末では編集用ファイルを保存できませんでした。印刷やPDF保存、通常の相談をご利用ください。入力内容は残っています。'; }
  finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); $('visitExportStatus').hidden = false; }
});
$('visitFile').addEventListener('change', async () => {
  const file = $('visitFile').files[0]; pendingFile = null; $('visitImportPanel').hidden = true; $('visitFileError').hidden = true;
  try {
    if (!file || !file.size || file.size > MAX_FILE_BYTES) throw Error('size');
    const checked = readVisitFile(await file.text()); if (!checked.ok) throw Error(checked.reason);
    pendingFile = checked;
    const counts = summarizeVisit(checked.memo).counts;
    $('visitImportSummary').textContent = locationText(checked.memo) + ' ／ 保存日：' + new Date(checked.savedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' ／ 確認済み' + counts.checked + '件・専門家に聞きたい' + counts.ask + '件';
    $('visitImportPreview').textContent = formatVisitText(checked.memo); $('visitImportPanel').hidden = false; $('visitImportPanel').querySelector('h2').focus();
  } catch (_) { $('visitFileError').textContent = 'この編集用ファイルを読み込めませんでした。このツールで保存した32KiB以内のファイルを選んでください。現在の入力は残っています。'; $('visitFileError').hidden = false; }
  $('visitFile').value = '';
});
$('visitImportConfirm').addEventListener('click', () => {
  if (!pendingFile) return; fill(pendingFile.memo); pendingFile = null; result = null; dirty = false;
  $('visitImportPanel').hidden = true; $('visitIntro').hidden = true; $('visitApp').hidden = false; $('visitPrintSheet').replaceChildren(); markStart(); track('jikka_visit_import_success', 1); showStep(1);
});
$('visitImportCancel').addEventListener('click', () => { pendingFile = null; $('visitImportPanel').hidden = true; $('visitFile').focus(); });
$('visitAttach').addEventListener('change', () => { $('visitConsult').disabled = !$('visitAttach').checked; });
$('visitConsult').addEventListener('click', () => {
  if (!result || !$('visitAttach').checked) return;
  try { const raw = JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), memo: result }); sessionStorage.setItem(VISIT_KEY, raw); if (sessionStorage.getItem(VISIT_KEY) !== raw) throw Error(); }
  catch (_) { $('visitHandoffError').textContent = 'このブラウザーではメモを引き継げません。先に編集用に保存するか印刷し、通常の相談へ進んでください。入力内容は残っています。'; $('visitHandoffError').hidden = false; return; }
  track('jikka_visit_consult_click', 3); const url = new URL('/karte/', location.origin); url.searchParams.set('entry', entry); url.searchParams.set('visit', '1'); url.hash = 'apply'; location.href = url.pathname + url.search + url.hash;
});
$('visitComparisonLink').addEventListener('click', event => { if (dirty && !window.confirm('移動すると、この画面の入力は失われます。残したい場合は先に編集用に保存するか印刷してください。比較メモへ移動しますか？')) event.preventDefault(); });
$('visitReset').addEventListener('click', () => {
  if (!window.confirm('入力した確認結果とメモをすべて消し、作り直しますか？保存済みのファイルは消えません。')) return;
  fill(createVisitMemo()); try { sessionStorage.removeItem(VISIT_KEY); } catch (_) {}
  pendingFile = null; result = null; dirty = false; $('visitResultContent').replaceChildren(); $('visitPrintSheet').replaceChildren(); $('visitImportPanel').hidden = true; showStep(1);
});
