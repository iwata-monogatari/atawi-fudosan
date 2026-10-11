import { PLAN_KEYS, PLAN_LABELS, COST_KEYS, COST_LABELS, FIELD_OPTIONS, CONCERN_LABELS, SUBTOTAL_NOTE, HANDOFF_KEY,
  createMemo, parseAmount, validateMemo, summarizeMemo, costText } from './jikka-memo-core.mjs?v=20261012';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const fieldMap = {
  'property.city': 'memoCity', 'property.town': 'memoTown', 'property.occupancy': 'memoOccupancy',
  'property.belongings': 'memoBelongings', 'property.concern': 'memoConcern',
  'family.familyWish': 'memoFamilyWish', 'family.timing': 'memoTiming', 'family.keepItems': 'memoKeepItems', 'family.worry': 'memoWorry'
};
let currentStep = 1, resultMemo = null, started = false, resultSeen = false;

function options(select, entries) {
  select.replaceChildren();
  for (const [value, label] of entries) { const option = node('option', label); option.value = value; select.append(option); }
}
function entriesFor(kind) { return Array.isArray(FIELD_OPTIONS[kind]) ? FIELD_OPTIONS[kind].map(value => [value, value]) : Object.entries(FIELD_OPTIONS[kind]); }
function notice(text) { $('memoNotice').textContent = text; $('memoNotice').hidden = !text; }
function track(name, step = currentStep) {
  const context = window.jikkaSpecial?.submission() || {};
  window.fgaMeasurement?.track(name, { tool: 'jikka-memo-v1', step: String(step), entry: context.entry || 'memo', concern: $('memoConcern').value });
}
function fieldError(input, text) {
  const id = input.id + 'Error';
  let error = $(id);
  if (!error) { error = node('p', '', 'jm-error'); error.id = id; error.setAttribute('role', 'alert'); input.after(error); }
  error.textContent = text;
  error.hidden = !text;
  if (text) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', [input.dataset.originalDescription || '', id].filter(Boolean).join(' ')); }
  else { input.removeAttribute('aria-invalid'); if (input.dataset.originalDescription) input.setAttribute('aria-describedby', input.dataset.originalDescription); else input.removeAttribute('aria-describedby'); }
}
function makeField(id, label, kind, type = 'select') {
  const wrap = node('div', undefined, 'jm-cost-field');
  const lab = node('label', label); lab.htmlFor = id;
  const input = node(type); input.id = id;
  if (kind) options(input, entriesFor(kind));
  wrap.append(lab, input);
  return { wrap, input };
}
function costId(plan, cost, field) { return 'memo_' + plan + '_' + cost + '_' + field; }

function buildCosts() {
  for (const planKey of PLAN_KEYS) {
    const details = node('details', undefined, 'jm-plan-input');
    details.dataset.plan = planKey;
    details.append(node('summary', PLAN_LABELS[planKey]));
    const content = node('div', undefined, 'jm-plan-input-content');
    const meta = node('div', undefined, 'jm-plan-meta');
    const source = makeField('memo_' + planKey + '_source', '情報の出所', 'source');
    const date = makeField('memo_' + planKey + '_checkedOn', '確認日（任意）', null, 'input'); date.input.type = 'date';
    meta.append(source.wrap, date.wrap); content.append(meta);
    fieldMap['plans.' + planKey + '.source'] = source.input.id;
    fieldMap['plans.' + planKey + '.checkedOn'] = date.input.id;
    for (const costKey of COST_KEYS) {
      const row = node('div', undefined, 'jm-cost-row'); row.append(node('h3', COST_LABELS[costKey]));
      const grid = node('div', undefined, 'jm-cost-fields');
      const state = makeField(costId(planKey, costKey, 'status'), 'この費用の状態', 'status'); state.wrap.classList.add('jm-cost-state');
      const amount = makeField(costId(planKey, costKey, 'amount'), '金額（円）', null, 'input');
      amount.input.type = 'text'; amount.input.inputMode = 'numeric'; amount.input.placeholder = '例：110,000'; amount.wrap.hidden = true;
      const tax = makeField(costId(planKey, costKey, 'tax'), '税込の確認', 'tax'); tax.wrap.hidden = true;
      const included = makeField(costId(planKey, costKey, 'includedIn'), '含まれている費目', null); included.wrap.hidden = true;
      grid.append(state.wrap, amount.wrap, tax.wrap, included.wrap); row.append(grid);
      if (costKey === 'other') {
        const label = makeField('memo_' + planKey + '_otherLabel', 'その他の内容（任意・20文字まで）', null, 'input');
        label.input.type = 'text'; label.wrap.style.marginTop = '12px'; row.append(label.wrap);
        fieldMap['plans.' + planKey + '.otherLabel'] = label.input.id;
      }
      for (const field of ['status', 'amount', 'tax', 'includedIn']) fieldMap['plans.' + planKey + '.costs.' + costKey + '.' + field] = costId(planKey, costKey, field);
      fieldMap['plans.' + planKey + '.costs.' + costKey] = state.input.id;
      state.input.addEventListener('change', () => {
        amount.wrap.hidden = state.input.value !== 'amount'; tax.wrap.hidden = state.input.value !== 'amount'; included.wrap.hidden = state.input.value !== 'included';
        if (state.input.value !== 'amount') { amount.input.value = ''; tax.input.value = 'unknown'; fieldError(amount.input, ''); }
        if (state.input.value !== 'included') included.input.value = '';
        refreshReferences(planKey);
      });
      content.append(row);
    }
    details.append(content); $('memoCostPlans').append(details); refreshReferences(planKey);
  }
}

function refreshReferences(planKey) {
  for (const costKey of COST_KEYS) {
    const select = $(costId(planKey, costKey, 'includedIn')), previous = select.value;
    const available = COST_KEYS.filter(key => key !== costKey && $(costId(planKey, key, 'status')).value === 'amount');
    options(select, [['', available.length ? '含まれている費目を選ぶ' : '先に別の費目で金額を入力'], ...available.map(key => [key, COST_LABELS[key]])]);
    if (available.includes(previous)) select.value = previous;
    else if (previous && $(costId(planKey, costKey, 'status')).value === 'included') {
      $(costId(planKey, costKey, 'status')).value = 'unknown'; select.parentElement.hidden = true;
      notice('含まれる先の費用が変更されたため、' + PLAN_LABELS[planKey] + 'の' + COST_LABELS[costKey] + 'を「未確認」に戻しました。');
    }
  }
}

function collect() {
  const memo = createMemo(), errors = {};
  for (const [path, id] of Object.entries(fieldMap)) {
    const parts = path.split('.');
    if (parts[0] === 'property' || parts[0] === 'family') memo[parts[0]][parts[1]] = $(id).value;
  }
  for (const plan of PLAN_KEYS) {
    for (const key of ['source', 'checkedOn', 'otherLabel']) memo.plans[plan][key] = $('memo_' + plan + '_' + key).value;
    for (const cost of COST_KEYS) {
      const row = memo.plans[plan].costs[cost]; row.status = $(costId(plan, cost, 'status')).value;
      if (row.status === 'amount') {
        const parsed = parseAmount($(costId(plan, cost, 'amount')).value);
        if (parsed.ok) row.amount = parsed.amount;
        else errors['plans.' + plan + '.costs.' + cost + '.amount'] = parsed.error;
        row.tax = $(costId(plan, cost, 'tax')).value;
      } else if (row.status === 'included') row.includedIn = $(costId(plan, cost, 'includedIn')).value;
    }
  }
  const valid = validateMemo(memo);
  return { memo: valid.memo || memo, errors: { ...valid.errors, ...errors } };
}

function showErrors(errors, step) {
  document.querySelectorAll('#memoForm [aria-invalid]').forEach(input => fieldError(input, ''));
  let first = null;
  for (const [path, message] of Object.entries(errors)) {
    const input = $(fieldMap[path]);
    if (!input || (step && !input.closest('[data-step="' + step + '"]'))) continue;
    fieldError(input, message);
    if (input.closest('details')) input.closest('details').open = true;
    first ||= input;
  }
  if (first) { first.focus(); return false; }
  return true;
}
function navigate(step) {
  if (step > currentStep) {
    const read = collect();
    if (step === 4) {
      if (Object.keys(read.errors).length) {
        const path = Object.keys(read.errors)[0], input = $(fieldMap[path]);
        const badStep = Number(input?.closest('[data-step]')?.dataset.step || currentStep);
        showStep(badStep); showErrors(read.errors); return;
      }
      resultMemo = read.memo; renderResult(resultMemo);
      if (!resultSeen) { track('jikka_memo_result_view', 4); resultSeen = true; }
    } else if (!showErrors(read.errors, currentStep)) return;
  }
  showStep(step);
}
function showStep(step) {
  currentStep = step;
  document.querySelectorAll('[data-step]').forEach(panel => { panel.hidden = Number(panel.dataset.step) !== step; });
  document.querySelectorAll('[data-progress]').forEach(item => {
    if (Number(item.dataset.progress) === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  });
  const heading = document.querySelector('[data-step="' + step + '"] h2'); heading?.focus();
  heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
}
function addParagraph(parent, text, className) { const p = node('p', text, className); parent.append(p); return p; }
function summaryLocation(memo) { return [memo.property.city === '不明' ? '所在地 未確認' : memo.property.city, memo.property.town].filter(Boolean).join(' '); }
function rowLabel(plan, cost) { return COST_LABELS[cost] + (cost === 'other' && plan.otherLabel ? '（' + plan.otherLabel + '）' : ''); }
function renderResult(memo) {
  const root = $('memoResultContent'); root.replaceChildren();
  const summary = summarizeMemo(memo), property = memo.property, family = memo.family;
  const top = node('div', undefined, 'jm-result-summary');
  addParagraph(top, summaryLocation(memo));
  addParagraph(top, '利用状況：' + FIELD_OPTIONS.occupancy[property.occupancy] + ' ／ 荷物：' + FIELD_OPTIONS.belongings[property.belongings]);
  addParagraph(top, '気になること：' + CONCERN_LABELS[property.concern]); root.append(top);
  const grid = node('div', undefined, 'jm-comparison');
  for (const plan of summary.plans) {
    const input = memo.plans[plan.key], card = node('section', undefined, 'jm-plan-result');
    card.append(node('h3', plan.label));
    addParagraph(card, '出所：' + FIELD_OPTIONS.source[input.source] + ' ／ 確認日：' + (input.checkedOn || '未確認'), 'jk-small');
    const dl = node('dl');
    for (const cost of COST_KEYS) dl.append(node('dt', rowLabel(input, cost)), node('dd', costText(input.costs[cost], input)));
    card.append(dl);
    const subtotal = node('div', undefined, 'jm-subtotal'); subtotal.append(node('span', '入力済みの税込費用小計'), node('strong', plan.subtotalText)); card.append(subtotal);
    addParagraph(card, '未確認 ' + plan.unknownCount + '件 ／ 税込確認待ち ' + plan.taxPendingCount + '件', 'jk-small'); grid.append(card);
  }
  root.append(grid); addParagraph(root, SUBTOTAL_NOTE, 'jk-note');
  const wishes = node('section', undefined, 'jm-result-family'); wishes.append(node('h3', '家族の希望'));
  addParagraph(wishes, FIELD_OPTIONS.familyWish[family.familyWish] + ' ／ 希望時期：' + FIELD_OPTIONS.timing[family.timing]);
  addParagraph(wishes, '残しておきたい物：' + (family.keepItems || '未記入'));
  addParagraph(wishes, '迷っていること：' + (family.worry || '未記入')); root.append(wishes);
  const next = node('section', undefined, 'jm-next'); next.append(node('h3', '次に確認したいこと'));
  const list = node('ol'); summary.actions.slice(0, 3).forEach(text => list.append(node('li', text))); next.append(list);
  if (summary.actions.length > 3) {
    const details = node('details'), other = node('ul'); details.append(node('summary', 'ほか' + (summary.actions.length - 3) + '件の確認事項を見る'));
    summary.actions.slice(3).forEach(text => other.append(node('li', text))); details.append(other); next.append(details);
  }
  addParagraph(next, '売却の可否、工事の必要性、家や土地の条件は、物件ごとに確認します。', 'jk-small'); root.append(next);
  $('memoAttach').checked = false; $('memoConsult').disabled = true; $('memoHandoffError').hidden = true;
  renderPrint(memo, summary);
}

function renderPrint(memo, summary) {
  const sheet = $('memoPrintSheet'); sheet.replaceChildren();
  addParagraph(sheet, 'ATAWI FUDOSAN ／ 家族で話すための要約'); sheet.append(node('h1', '実家の片付け・解体 比較メモ'));
  addParagraph(sheet, '作成日時：' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + '（日本時間）', 'jm-print-meta');
  addParagraph(sheet, summaryLocation(memo) + ' ／ 利用状況：' + FIELD_OPTIONS.occupancy[memo.property.occupancy] + ' ／ 荷物：' + FIELD_OPTIONS.belongings[memo.property.belongings]);
  addParagraph(sheet, '気になること：' + CONCERN_LABELS[memo.property.concern]);
  const table = node('table'), head = node('thead'), header = node('tr');
  header.append(node('th', '費目')); PLAN_KEYS.forEach(key => header.append(node('th', PLAN_LABELS[key]))); head.append(header); table.append(head);
  const body = node('tbody');
  const provenance = node('tr'); provenance.append(node('th', '出所・確認日'));
  PLAN_KEYS.forEach(key => provenance.append(node('td', FIELD_OPTIONS.source[memo.plans[key].source] + ' / ' + (memo.plans[key].checkedOn || '未確認')))); body.append(provenance);
  for (const cost of COST_KEYS) {
    const row = node('tr'); row.append(node('th', COST_LABELS[cost]));
    PLAN_KEYS.forEach(key => row.append(node('td', (cost === 'other' && memo.plans[key].otherLabel ? memo.plans[key].otherLabel + '：' : '') + costText(memo.plans[key].costs[cost], memo.plans[key])))); body.append(row);
  }
  const total = node('tr'); total.append(node('th', '入力済み税込小計'));
  summary.plans.forEach(plan => total.append(node('td', plan.subtotalText + ' / 未確認' + plan.unknownCount + '件・税込確認待ち' + plan.taxPendingCount + '件'))); body.append(total); table.append(body); sheet.append(table);
  sheet.append(node('h2', '家族の希望'));
  addParagraph(sheet, FIELD_OPTIONS.familyWish[memo.family.familyWish] + ' ／ 希望時期：' + FIELD_OPTIONS.timing[memo.family.timing]);
  addParagraph(sheet, '残しておきたい物：' + (memo.family.keepItems || '未記入'));
  addParagraph(sheet, '迷っていること：' + (memo.family.worry || '未記入'));
  sheet.append(node('h2', '次に確認したいこと'));
  const list = node('ol'); summary.actions.slice(0, 3).forEach(text => list.append(node('li', text))); sheet.append(list);
  if (summary.actions.length > 3) addParagraph(sheet, 'ほか' + (summary.actions.length - 3) + '件の確認事項があります。すべての確認事項はツールの結果画面でご確認ください。');
  addParagraph(sheet, SUBTOTAL_NOTE, 'jm-print-note');
  addParagraph(sheet, '売却可否・工事の必要性は個別に確認します。相談：0538-31-3308 ／ fudosan.atawi.link');
}

document.querySelectorAll('select[data-kind]').forEach(select => options(select, entriesFor(select.dataset.kind)));
$('memoConcern').value = 'undecided';
buildCosts();
document.querySelectorAll('#memoForm input, #memoForm select, #memoForm textarea').forEach(input => { input.dataset.originalDescription = input.getAttribute('aria-describedby') || ''; });
const initialConcern = new URLSearchParams(location.search).get('concern');
if (Object.hasOwn(CONCERN_LABELS, initialConcern)) $('memoConcern').value = initialConcern;
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => navigate(Number(button.dataset.next))));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => navigate(Number(button.dataset.back))));
$('memoForm').addEventListener('submit', event => { event.preventDefault(); navigate(Math.min(4, currentStep + 1)); });
$('memoForm').addEventListener('input', () => { if (!started) { track('jikka_memo_start'); started = true; } });
$('memoForm').addEventListener('change', () => { if (!started) { track('jikka_memo_start'); started = true; } });
$('memoStart').disabled = false;
$('memoStart').addEventListener('click', () => { $('memoIntro').hidden = true; $('memoApp').hidden = false; showStep(1); });
$('memoPrint').addEventListener('click', () => { if (!resultMemo) return; renderPrint(resultMemo, summarizeMemo(resultMemo)); track('jikka_memo_print_requested', 4); window.print(); });
$('memoAttach').addEventListener('change', () => { $('memoConsult').disabled = !$('memoAttach').checked; });
$('memoConsult').addEventListener('click', () => {
  if (!resultMemo || !$('memoAttach').checked) return;
  try {
    const saved = JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), memo: resultMemo });
    sessionStorage.setItem(HANDOFF_KEY, saved);
    if (sessionStorage.getItem(HANDOFF_KEY) !== saved) throw new Error('storage_unavailable');
  } catch (_) {
    $('memoHandoffError').textContent = 'このブラウザーではメモを引き継げません。先に印刷・PDF保存をしてから、上の「通常の相談へ」をご利用ください。'; $('memoHandoffError').hidden = false; return;
  }
  const context = window.jikkaSpecial?.submission() || {}, url = new URL('/karte/', location.origin);
  url.searchParams.set('entry', context.entry || 'memo'); url.searchParams.set('concern', resultMemo.property.concern); url.searchParams.set('memo', '1'); url.hash = 'apply';
  track('jikka_memo_consult_click', 4); location.href = url.pathname + url.search + url.hash;
});
$('memoReset').addEventListener('click', () => {
  $('memoForm').reset();
  for (const plan of PLAN_KEYS) for (const cost of COST_KEYS) $(costId(plan, cost, 'status')).dispatchEvent(new Event('change'));
  document.querySelectorAll('#memoForm [aria-invalid]').forEach(input => fieldError(input, ''));
  try { sessionStorage.removeItem(HANDOFF_KEY); } catch (_) {}
  resultMemo = null; $('memoResultContent').replaceChildren(); $('memoPrintSheet').replaceChildren(); $('memoAttach').checked = false; $('memoConsult').disabled = true;
  notice('入力を消去しました。分かることから作り直せます。'); showStep(1);
});
