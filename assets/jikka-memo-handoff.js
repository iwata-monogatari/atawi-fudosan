import { HANDOFF_KEY, readHandoff, formatMemoText } from './jikka-memo-core.mjs?v=20261012';
import { mountHandoff } from './jikka-handoff-controller.mjs?v=20261012-visit';
window.jikkaMemoHandoff = mountHandoff({
  prefix: 'memoHandoff', key: HANDOFF_KEY, flag: 'memo', label: '比較メモ', read: readHandoff, format: formatMemoText,
  trackSuccess(attached) { window.fgaMeasurement?.track('jikka_memo_application_success', { tool: 'jikka-memo-v1', step: '4', entry: window.jikkaSpecial?.submission().entry || 'memo', concern: attached.property.concern }); }
});
