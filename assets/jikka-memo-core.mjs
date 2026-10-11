export const PLAN_LABELS = { as_is: '古家のまま売る', cleanup: '片付けて売る', demolition: '解体して売る' };
export const COST_LABELS = { cleanup: '残置物処分', demolition: '建物解体', exterior: '庭木・外構等', survey: '測量・境界', other: 'その他' };
export const CONCERN_LABELS = { belongings: '荷物が残っている', demolition: '解体するか迷っている', distant: '遠方で管理が難しい', care: '親の施設入居後の家', garden: '庭木・残置物が気になる', undecided: 'まだ決まっていない' };
export const FIELD_OPTIONS = {
  city: ['不明', '磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市', 'その他'],
  occupancy: { unknown: '不明', vacant: '空き家', occupied: '居住・利用中' },
  belongings: { unknown: '不明', many: '多い', some: '少しある', none: 'ほぼない' },
  concern: CONCERN_LABELS,
  familyWish: { undecided: '未定', sell: '売却を考えたい', keep: '保有を考えたい', divided: '意見が分かれる' },
  timing: { undecided: '未定', three_months: '3か月以内', six_months: '半年以内', one_year: '1年以内' },
  source: { unknown: '不明', quote: '見積書', own: '自分のメモ', mixed: '混在' },
  status: { unknown: '未確認', amount: '金額を入力', included: '別の費用に含む', not_planned: 'この案では行わない' },
  tax: { unknown: '税込か不明', included: '税込', excluded: '税別' }
};
export const PLAN_KEYS = Object.keys(PLAN_LABELS);
export const COST_KEYS = Object.keys(COST_LABELS);
export const HANDOFF_KEY = 'atawi_jikka_memo_handoff_v1';
export const HANDOFF_TTL = 30 * 60 * 1000;
export const MAX_MEMO_BYTES = 16 * 1024;
export const SUBTOTAL_NOTE = 'この小計は入力された税込費用の一部です。未確認の費用、売却に伴う税金・仲介手数料・借入返済等を含む最終的な手残りではありません。';

export function emptyCost() { return { status: 'unknown', amount: null, tax: null, includedIn: null }; }
export function createMemo() {
  return {
    schemaVersion: 1,
    property: { city: '不明', town: '', occupancy: 'unknown', belongings: 'unknown', concern: 'undecided' },
    family: { familyWish: 'undecided', timing: 'undecided', keepItems: '', worry: '' },
    plans: Object.fromEntries(PLAN_KEYS.map(key => [key, {
      source: 'unknown', checkedOn: '', otherLabel: '', costs: Object.fromEntries(COST_KEYS.map(cost => [cost, emptyCost()]))
    }]))
  };
}

export function parseAmount(value) {
  if (typeof value !== 'string') return { ok: false, error: '整数の円額を入力してください。' };
  const normalized = value.trim().replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10)).replace(/，/g, ',');
  if (!normalized) return { ok: false, error: '金額を入力するか、状態を「未確認」に戻してください。' };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(normalized)) return { ok: false, error: '0以上の整数を円で入力してください。例：110,000' };
  const amount = Number(normalized.replace(/,/g, ''));
  if (!Number.isSafeInteger(amount) || amount > 100000000) return { ok: false, error: '金額は0〜100,000,000円で入力してください。' };
  return { ok: true, amount };
}

function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function hasOnly(value, keys) { return plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function enumValues(key) { return Array.isArray(FIELD_OPTIONS[key]) ? FIELD_OPTIONS[key] : Object.keys(FIELD_OPTIONS[key]); }
function validDate(value) {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = new Date(value + 'T00:00:00Z');
  return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value;
}

// Strict shared schema. The browser normalizes amount text before passing numbers here.
export function validateMemo(input) {
  const errors = {};
  const fail = (key, message) => { errors[key] = message; };
  if (!hasOnly(input, ['schemaVersion', 'property', 'family', 'plans']) || input.schemaVersion !== 1) {
    return { ok: false, errors: { memo: '比較メモの形式を確認してください。' } };
  }
  try { if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_MEMO_BYTES) fail('memo', '比較メモの容量が上限を超えています。'); }
  catch (_) { return { ok: false, errors: { memo: '比較メモの形式を確認してください。' } }; }
  const result = createMemo();
  const text = (value, limit, key) => {
    if (typeof value !== 'string') { fail(key, '文字で入力してください。'); return ''; }
    const normalized = value.trim();
    if (Array.from(normalized).length > limit) fail(key, limit + '文字以内で入力してください。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) fail(key, '使用できない制御文字が含まれています。');
    return normalized;
  };
  const selection = (value, kind, key) => {
    if (typeof value !== 'string' || !enumValues(kind).includes(value)) { fail(key, '選択肢からお選びください。'); return result.property[key] || ''; }
    return value;
  };
  if (!hasOnly(input.property, ['city', 'town', 'occupancy', 'belongings', 'concern'])) fail('property', '家の状況の形式を確認してください。');
  else {
    for (const key of ['city', 'occupancy', 'belongings', 'concern']) result.property[key] = selection(input.property[key], key, 'property.' + key);
    result.property.town = text(input.property.town, 40, 'property.town');
  }
  if (!hasOnly(input.family, ['familyWish', 'timing', 'keepItems', 'worry'])) fail('family', '家族の希望の形式を確認してください。');
  else {
    for (const key of ['familyWish', 'timing']) result.family[key] = selection(input.family[key], key, 'family.' + key);
    result.family.keepItems = text(input.family.keepItems, 100, 'family.keepItems');
    result.family.worry = text(input.family.worry, 160, 'family.worry');
  }
  if (!hasOnly(input.plans, PLAN_KEYS)) fail('plans', '比較する案の形式を確認してください。');
  else for (const planKey of PLAN_KEYS) {
    const plan = input.plans[planKey], path = 'plans.' + planKey;
    if (!hasOnly(plan, ['source', 'checkedOn', 'otherLabel', 'costs'])) { fail(path, '案の形式を確認してください。'); continue; }
    const target = result.plans[planKey];
    target.source = selection(plan.source, 'source', path + '.source');
    target.checkedOn = text(plan.checkedOn, 10, path + '.checkedOn');
    if (!validDate(target.checkedOn)) fail(path + '.checkedOn', '実在する日付をYYYY-MM-DDで入力してください。');
    target.otherLabel = text(plan.otherLabel, 20, path + '.otherLabel');
    if (!hasOnly(plan.costs, COST_KEYS)) { fail(path + '.costs', '費目の形式を確認してください。'); continue; }
    for (const costKey of COST_KEYS) {
      const cost = plan.costs[costKey], costPath = path + '.costs.' + costKey;
      if (!hasOnly(cost, ['status', 'amount', 'tax', 'includedIn'])) { fail(costPath, '費用の形式を確認してください。'); continue; }
      const row = target.costs[costKey];
      row.status = selection(cost.status, 'status', costPath + '.status');
      if (cost.status === 'amount') {
        if (!Number.isSafeInteger(cost.amount) || cost.amount < 0 || cost.amount > 100000000) fail(costPath + '.amount', '0〜100,000,000円の整数を入力してください。');
        row.amount = cost.amount;
        row.tax = selection(cost.tax, 'tax', costPath + '.tax');
        if (cost.includedIn !== null) fail(costPath + '.includedIn', '金額入力の参照値は空にしてください。');
      } else if (cost.status === 'included') {
        if (!COST_KEYS.includes(cost.includedIn) || cost.includedIn === costKey || plan.costs[cost.includedIn]?.status !== 'amount') fail(costPath + '.includedIn', '同じ案の金額入力済み費目を選んでください。');
        row.includedIn = cost.includedIn;
        if (cost.amount !== null || cost.tax !== null) fail(costPath, '含まれる費用には別の金額を入力できません。');
      } else if (cost.amount !== null || cost.tax !== null || cost.includedIn !== null) fail(costPath, '未確認・行わない費用の金額は空にしてください。');
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, memo: result, errors: {} };
}

export function money(value) { return value.toLocaleString('ja-JP') + '円'; }
export function costText(cost, plan) {
  if (cost.status === 'unknown') return '未確認';
  if (cost.status === 'not_planned') return 'この案では行わない';
  if (cost.status === 'included') return COST_LABELS[cost.includedIn] + 'に含む';
  return money(cost.amount) + '（' + FIELD_OPTIONS.tax[cost.tax] + '）';
}
export function summarizeMemo(memo) {
  const plans = PLAN_KEYS.map(key => {
    const plan = memo.plans[key];
    const rows = COST_KEYS.map(cost => plan.costs[cost]);
    const eligible = rows.filter(row => row.status === 'amount' && row.tax === 'included');
    return {
      key, label: PLAN_LABELS[key], subtotal: eligible.length ? eligible.reduce((sum, row) => sum + row.amount, 0) : null,
      subtotalText: eligible.length ? money(eligible.reduce((sum, row) => sum + row.amount, 0)) : rows.every(row => row.status === 'not_planned') ? '対象費用なし' : '未集計',
      unknownCount: rows.filter(row => row.status === 'unknown').length,
      taxPendingCount: rows.filter(row => row.status === 'amount' && row.tax !== 'included').length
    };
  });
  const actions = [];
  for (const plan of plans) if (plan.taxPendingCount) actions.push(plan.label + '：見積先に税込総額を確認する');
  for (const cost of COST_KEYS) {
    const unknownPlans = PLAN_KEYS.filter(key => memo.plans[key].costs[cost].status === 'unknown');
    if (unknownPlans.length) actions.push(COST_LABELS[cost] + 'の費用・作業範囲を確認する（' + unknownPlans.map(key => PLAN_LABELS[key]).join('・') + '）');
  }
  const datedPlans = PLAN_KEYS.filter(key => COST_KEYS.some(cost => memo.plans[key].costs[cost].status === 'amount'));
  if (datedPlans.length > 1 && new Set(datedPlans.map(key => memo.plans[key].source + '|' + memo.plans[key].checkedOn)).size > 1) actions.push('見積りの確認日・出所が異なります。比較の前提と有効期間をそろえて確認する');
  if (datedPlans.some(key => !memo.plans[key].checkedOn || memo.plans[key].source === 'unknown')) actions.push('入力した費用の出所・確認日・見積りの有効期間を確認する');
  if (['many', 'some'].includes(memo.property.belongings)) actions.push('家族で残しておきたい物と処分する範囲を確認する');
  if (memo.property.concern === 'demolition') actions.push('解体を依頼する前に建物・土地の条件を確認する');
  if (memo.property.concern === 'distant') actions.push('写真や資料で分かることと、現地で必要な確認を整理する');
  if (memo.family.familyWish === 'divided') actions.push('家族それぞれの希望と、次に話し合うことを確認する');
  if (memo.family.familyWish === 'keep') actions.push('保有する場合の管理・費用についても相談する');
  if (!actions.length) actions.push('費用に含まれる作業範囲と、家・土地の条件を確認する');
  return { plans, actions: [...new Set(actions)] };
}

export function formatMemoText(memo) {
  const summary = summarizeMemo(memo);
  const lines = ['比較メモ（利用者入力）', '所在地: ' + [memo.property.city, memo.property.town].filter(Boolean).join(' '),
    '利用状況: ' + FIELD_OPTIONS.occupancy[memo.property.occupancy], '荷物: ' + FIELD_OPTIONS.belongings[memo.property.belongings],
    '主な悩み: ' + CONCERN_LABELS[memo.property.concern], ''];
  for (const plan of summary.plans) {
    const input = memo.plans[plan.key];
    lines.push('【' + plan.label + '】', '出所: ' + FIELD_OPTIONS.source[input.source] + ' / 確認日: ' + (input.checkedOn || '未確認'));
    for (const cost of COST_KEYS) lines.push(COST_LABELS[cost] + (cost === 'other' && input.otherLabel ? '（' + input.otherLabel + '）' : '') + ': ' + costText(input.costs[cost], input));
    lines.push('入力済みの税込費用小計: ' + plan.subtotalText, '未確認 ' + plan.unknownCount + '件 / 税込確認待ち ' + plan.taxPendingCount + '件', '');
  }
  lines.push('家族の希望: ' + FIELD_OPTIONS.familyWish[memo.family.familyWish], '希望時期: ' + FIELD_OPTIONS.timing[memo.family.timing],
    '残しておきたい物: ' + (memo.family.keepItems || '未記入'), '迷っていること: ' + (memo.family.worry || '未記入'), '', '次の確認事項:');
  summary.actions.forEach(item => lines.push('・' + item));
  lines.push('', SUBTOTAL_NOTE, '売却可否や工事の必要性は、物件ごとに確認します。');
  return lines.join('\n');
}

export function readHandoff(raw, now = Date.now()) {
  if (!raw) return { ok: false, reason: 'missing' };
  let stored;
  try { stored = JSON.parse(raw); } catch (_) { return { ok: false, reason: 'invalid' }; }
  if (!hasOnly(stored, ['schemaVersion', 'createdAt', 'memo']) || stored.schemaVersion !== 1 || typeof stored.createdAt !== 'string') return { ok: false, reason: 'invalid' };
  const created = Date.parse(stored.createdAt);
  if (!Number.isFinite(created) || created > now) return { ok: false, reason: 'invalid' };
  if (now - created >= HANDOFF_TTL) return { ok: false, reason: 'expired' };
  const valid = validateMemo(stored.memo);
  return valid.ok ? { ok: true, memo: valid.memo, expiresAt: created + HANDOFF_TTL } : { ok: false, reason: 'invalid' };
}
