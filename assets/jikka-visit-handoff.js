import { VISIT_KEY, readVisitHandoff, formatVisitText } from './jikka-visit-core.mjs?v=20261012-visit';
import { mountHandoff } from './jikka-handoff-controller.mjs?v=20261012-visit';
window.jikkaVisitHandoff = mountHandoff({
  prefix: 'visitHandoff', key: VISIT_KEY, flag: 'visit', label: '現地確認メモ', read: readVisitHandoff, format: formatVisitText,
  trackSuccess() { window.fgaMeasurement?.track('jikka_visit_application_success', { tool: 'jikka-visit-v1', step: '3', entry: 'visit-memo' }); }
});
