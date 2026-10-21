export const campaign = 'mori_jikka_20261018';
const entries = new Set(['home_sale','hub_top','hub_sample','hub_organize','hub_sale','hub_bottom','hub_bottom_sale','sell_top','sell_bottom','sell_bottom_organize']);
for (const entry of ['growth_home', 'growth_blog', 'growth_owner']) entries.add(entry);
for (const page of ['inherited_house','sell_house']) for (const placement of ['early','bottom','mobile']) for (const suffix of ['', '_sample','_sale']) entries.add(`${page}_${placement}${suffix}`);
export function normalizeMoriIntake(value, address) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.campaign !== campaign || !entries.has(value.entry) || !['sale','organize'].includes(value.intent)) throw new Error('invalid_mori_intake');
  if (!String(address || '').replace(/[\s　]/g,'').replace(/^静岡県/,'').replace(/^周智郡/,'').startsWith('森町')) throw new Error('invalid_mori_intake');
  return { campaign, entry:value.entry, intent:value.intent };
}
export function moriOperations(data, receipt) {
  if (!receipt) return [];
  const sale = data.moriIntake.intent === 'sale';
  return ['', '【森町の受付と次の対応】', '受付番号: ' + receipt.id,
    '相談の希望: ' + (sale ? '売却相談・現地確認を検討' : 'まず状況整理・実家カルテ'),
    '流入元: 森町ライフハック / ' + data.moriIntake.entry,
    '受付区分: フォーム送信を受信（連絡成立・媒介契約ではありません）',
    '1. 原則2営業日以内に、ご希望の方法で初回連絡。水曜・日曜・臨時休業日を除く。',
    '2. 所有者との関係、物件の状況、ご家族の意向、希望時期、帰省予定を確認。',
    sale ? '3. 売却の希望を確認し、現地確認の方法・日程と次回連絡日を相談。' : '3. 必要情報と送付先を確認し、そろった日の翌々日までにカルテを送付（土日含む）。',
    '4. 未確認点と次の対応を記録。再連絡の時期・方法はご本人と相談して決める。',
    '5. 受付番号で運用台帳に記録：受付→連絡成立→現地確認→媒介契約→成約。実際に確認できた段階だけ更新。', ''];
}
