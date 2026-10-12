export const VISIT_KEY = 'atawi_jikka_visit_handoff_v1';
export const VISIT_TTL = 30 * 60 * 1000;
export const MAX_VISIT_BYTES = 16 * 1024;
export const MAX_FILE_BYTES = 32 * 1024;
export const CITIES = ['unknown', '磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市'];
export const STATUS = { unknown: '未確認', checked: '確認済み', unavailable: '今回は確認できない', ask: '専門家に聞きたい' };
export const RECORD = { none: '未記録', photo: '写真あり', note: 'メモあり', unnecessary: '記録不要' };
export const PHASE = { before: '帰省前', during: '確認中', after: '確認後' };
export const ACCESS = { unknown: 'まだ分からない', yes: '見られる予定', no: '今回は見られない' };
export const CONCERNS = { building: '建物の状態', belongings: '荷物', garden: '庭木・外構', access: '出入口・道路', documents: '手元の資料' };
export const ITEMS = [
  { id: 'exterior', label: '外観', group: '屋外', concern: 'building', guide: '離れた安全な位置から建物全体。気になる外壁などは全体と近景を撮ります。屋根へ上らないでください。', short: '安全な位置から建物全体と気になる箇所' },
  { id: 'entrance', label: '玄関周辺', group: '屋外', concern: 'access', guide: '玄関までの通路と出入口を見ます。鍵の所在や番号はこのメモに書かないでください。', short: '玄関までの通路と出入口' },
  { id: 'road', label: '前面道路', group: '屋外', concern: 'access', guide: '敷地の出入口と道路の見え方を撮ります。道路上で危険な撮影をせず、接道条件は担当者に確認します。', short: '敷地の出入口と道路の見え方' },
  { id: 'garden', label: '庭木と外構', group: '屋外', concern: 'garden', guide: '自分の敷地側から庭木、塀、草の広がりを撮ります。境界や越境は写真だけで断定しません。', short: '庭木・塀・草の広がり' },
  { id: 'indoor', label: '室内の全体', group: '屋内', concern: 'building', guide: '入る許可があり、安全に見られる場合だけ、部屋の入口から全体を撮ります。', short: '見られる場合だけ部屋の入口から全体' },
  { id: 'belongings', label: '荷物', group: '屋内', concern: 'belongings', guide: '荷物の量と残したい物を全体で記録します。個人の書類や貴重品を撮り込まないでください。', short: '荷物の量と残したい物' },
  { id: 'water_marks', label: '水染みなど', group: '屋内', concern: 'building', guide: '目視で気になった箇所を全体と近景で記録します。原因や修繕費は別に確認します。', short: '目視で気になった箇所の全体と近景' },
  { id: 'tax_notice', label: '固定資産税の通知', group: '資料', concern: 'documents', guide: '通知の有無、年度、対象物件が分かるかを確認します。個人番号等を転記しないでください。', short: '通知の有無・年度・対象物件' },
  { id: 'registry', label: '登記関係資料', group: '資料', concern: 'documents', guide: '手元の資料名と日付を控えます。古い資料だけで現在の名義を断定せず、担当者に確認します。', short: '手元にある資料名と日付' },
  { id: 'boundary', label: '境界と測量の資料', group: '資料', concern: 'documents', guide: '図面や確認書があるかを見ます。現地の境界標を動かしたり、線を引いたりしないでください。', short: '図面や確認書の有無' },
  { id: 'floor_plan', label: '間取り図', group: '資料', concern: 'documents', guide: '図面があるか、現在の間取りとの違いをメモします。正確な測量をする必要はありません。', short: '図面の有無と現在との違い' },
  { id: 'utilities', label: '公共料金等の通知', group: '資料', concern: 'documents', guide: '電気、水道、保険等の通知の有無を確認します。契約番号や口座情報は入力しないでください。', short: '電気・水道・保険等の通知の有無' }
];
const ids = ITEMS.map(item => item.id);
const own = (obj, keys) => obj !== null && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length === keys.length && keys.every(key => Object.hasOwn(obj, key));
export const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
export const japanDate = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
export function createVisitMemo() {
  return { schemaVersion: 1, property: { city: 'unknown', town: '' }, visit: { phase: 'before', plannedOn: null, checkedOn: null, indoorAccess: 'unknown', concerns: [] }, items: Object.fromEntries(ids.map(id => [id, { status: 'unknown', record: 'none', note: '' }])), question: '' };
}
function realDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2100-12-31' && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function validateVisitMemo(input, now = Date.now()) {
  const errors = {}, result = createVisitMemo();
  const fail = (key, message) => { errors[key] = message; };
  if (!own(input, ['schemaVersion', 'property', 'visit', 'items', 'question']) || input.schemaVersion !== 1) return { ok: false, errors: { memo: '現地確認メモの形式を確認してください。' } };
  try { if (bytes(input) > MAX_VISIT_BYTES) fail('memo', 'メモの容量が上限を超えています。'); } catch (_) { return { ok: false, errors: { memo: 'メモの形式を確認してください。' } }; }
  const text = (value, max, key) => {
    if (typeof value !== 'string') { fail(key, '文字で入力してください。'); return ''; }
    const normalized = value.replace(/\r\n?/g, '\n').trim();
    if (Array.from(normalized).length > max) fail(key, max + '文字以内で入力してください。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) fail(key, '使用できない制御文字が含まれています。');
    return normalized;
  };
  const selection = (value, options, key) => { if (typeof value !== 'string' || !options.includes(value)) fail(key, '選択肢からお選びください。'); return value; };
  if (!own(input.property, ['city', 'town'])) fail('property', '所在地の形式を確認してください。');
  else { result.property.city = selection(input.property.city, CITIES, 'property.city'); result.property.town = text(input.property.town, 40, 'property.town'); }
  if (!own(input.visit, ['phase', 'plannedOn', 'checkedOn', 'indoorAccess', 'concerns'])) fail('visit', '状況の形式を確認してください。');
  else {
    result.visit.phase = selection(input.visit.phase, Object.keys(PHASE), 'visit.phase');
    result.visit.indoorAccess = selection(input.visit.indoorAccess, Object.keys(ACCESS), 'visit.indoorAccess');
    for (const key of ['plannedOn', 'checkedOn']) {
      const value = input.visit[key]; result.visit[key] = value;
      if (value !== null && (!realDate(value) || (key === 'checkedOn' && value > japanDate(now)))) fail('visit.' + key, key === 'checkedOn' ? '確認日は日本時間の今日以前の実在する日付にしてください。' : '1900〜2100年の実在する日付を入力してください。');
    }
    const values = input.visit.concerns;
    if (!Array.isArray(values) || values.length > 3 || new Set(values).size !== values.length || values.some(v => typeof v !== 'string' || !Object.hasOwn(CONCERNS, v))) fail('visit.concerns', '気になる点は3つまで、重複せず選んでください。');
    else result.visit.concerns = [...values];
  }
  if (!own(input.items, ids)) fail('items', '確認項目の形式を確認してください。');
  else for (const id of ids) {
    const row = input.items[id], key = 'items.' + id;
    if (!own(row, ['status', 'record', 'note'])) { fail(key, '記録の形式を確認してください。'); continue; }
    const target = result.items[id];
    target.status = selection(row.status, Object.keys(STATUS), key + '.status');
    target.record = selection(row.record, Object.keys(RECORD), key + '.record');
    target.note = text(row.note, 80, key + '.note');
    if (row.record === 'note' && !target.note) fail(key + '.note', '「メモあり」を選んだ場合は内容を記入してください。');
  }
  result.question = text(input.question, 160, 'question');
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, memo: result, errors: {} };
}
export function summarizeVisit(memo) {
  const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, 0]));
  for (const id of ids) counts[memo.items[id].status]++;
  const actions = [];
  for (const state of ['ask', 'unavailable', 'unknown']) for (const item of ITEMS) if (memo.items[item.id].status === state) actions.push(item.label + (state === 'ask' ? 'は専門家に聞きたい項目です。' : state === 'unavailable' ? 'は今回は確認できていません。' : 'はまだ確認していません。'));
  if (!actions.length) actions.push('確認結果を家族と共有し、必要なら相談しましょう。');
  return { counts, actions };
}
export function locationText(memo) { return [memo.property.city === 'unknown' ? '所在地 未確認' : memo.property.city, memo.property.town].filter(Boolean).join(' '); }
export function formatVisitText(memo) {
  const summary = summarizeVisit(memo);
  const lines = ['現地確認メモ 利用者の記録', '所在地: ' + locationText(memo), '入力段階: ' + PHASE[memo.visit.phase], '訪問予定日: ' + (memo.visit.plannedOn || '未定'), '最後に確認した日: ' + (memo.visit.checkedOn || '未記入'), '室内の確認: ' + ACCESS[memo.visit.indoorAccess], '気になる点: ' + (memo.visit.concerns.map(key => CONCERNS[key]).join('・') || 'まだ決まっていない'), ''];
  for (const item of ITEMS) { const row = memo.items[item.id]; lines.push(item.label + ': ' + STATUS[row.status] + ' / ' + RECORD[row.record]); if (row.note) lines.push('  メモ: ' + row.note); }
  lines.push('', '全体の相談メモ: ' + (memo.question || '未記入'), '', '記録の件数（全12項目）:');
  for (const [key, label] of Object.entries(STATUS)) lines.push(label + ': ' + summary.counts[key] + '件');
  lines.push('', '次の確認事項:', ...summary.actions.map(text => '・' + text), '', '「確認済み」は利用者が見た記録で、安全性や売却可能性の判断ではありません。', '「写真あり」は利用者の端末に写真があるという記録です。このメモに画像は含まれません。');
  return lines.join('\n');
}
function timestamp(value) { const date = typeof value === 'string' ? new Date(value) : null; return date && Number.isFinite(date.getTime()) && date.toISOString() === value ? date.getTime() : NaN; }
export function readVisitHandoff(raw, now = Date.now()) {
  if (!raw) return { ok: false, reason: 'missing' };
  let data; try { if (bytes(raw) > MAX_FILE_BYTES) throw Error(); data = JSON.parse(raw); } catch (_) { return { ok: false, reason: 'invalid' }; }
  if (!own(data, ['schemaVersion', 'createdAt', 'memo']) || data.schemaVersion !== 1) return { ok: false, reason: 'invalid' };
  const created = timestamp(data.createdAt);
  if (!Number.isFinite(created) || created > now) return { ok: false, reason: 'invalid' };
  if (now - created >= VISIT_TTL) return { ok: false, reason: 'expired' };
  const checked = validateVisitMemo(data.memo, now);
  return checked.ok ? { ok: true, memo: checked.memo, expiresAt: created + VISIT_TTL } : { ok: false, reason: 'invalid' };
}
export function serializeVisitFile(memo, now = Date.now()) {
  const checked = validateVisitMemo(memo, now);
  if (!checked.ok) throw new Error('invalid_visit');
  return JSON.stringify({ kind: 'atawi-jikka-visit', fileVersion: 1, savedAt: new Date(now).toISOString(), memo: checked.memo }, null, 2);
}
export function readVisitFile(raw, now = Date.now()) {
  if (typeof raw !== 'string' || !raw || bytes(raw) > MAX_FILE_BYTES) return { ok: false, reason: 'size' };
  let file; try { file = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch (_) { return { ok: false, reason: 'invalid' }; }
  if (!own(file, ['kind', 'fileVersion', 'savedAt', 'memo']) || file.kind !== 'atawi-jikka-visit' || file.fileVersion !== 1) return { ok: false, reason: 'version' };
  const saved = timestamp(file.savedAt);
  if (!Number.isFinite(saved) || saved > now) return { ok: false, reason: 'invalid' };
  const checked = validateVisitMemo(file.memo, now);
  return checked.ok ? { ok: true, memo: checked.memo, savedAt: file.savedAt } : { ok: false, reason: 'invalid' };
}
