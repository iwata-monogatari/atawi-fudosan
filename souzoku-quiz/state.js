'use strict';
// Only known answer indices and UI state are restored. No personal information is stored.
function validateQuizState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = ['kind','index','answers','concern','view','started','completed'];
  if (Object.keys(value).some(key => !allowed.includes(key))) return null;
  if (!['house','land'].includes(value.kind) || !['question','result'].includes(value.view)) return null;
  if (!Number.isInteger(value.index) || value.index < 0 || value.index > 5) return null;
  if (!Array.isArray(value.answers) || value.answers.length > 6) return null;
  const counts = [3,2,2,3,2,3];
  if (value.answers.some((answer,i) => !Number.isInteger(answer) || answer < 0 || answer >= counts[i])) return null;
  if (value.answers.length < value.index || (value.view === 'result' && value.answers.length !== 6)) return null;
  if (value.concern !== null && !['title','cost','use','undecided'].includes(value.concern)) return null;
  if (typeof value.started !== 'boolean' || typeof value.completed !== 'boolean') return null;
  return {kind:value.kind,index:value.index,answers:[...value.answers],concern:value.concern,view:value.view,started:value.started,completed:value.completed};
}
if (typeof module !== 'undefined') module.exports = {validateQuizState};
