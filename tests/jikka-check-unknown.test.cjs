const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('jikka/check/index.html', 'utf8');
const json = JSON.parse(html.match(/<script type="application\/json" id="diagnosisData">([^<]+)<\/script>/)[1]);
for (const [name, value, result] of [['management','unknown_management','management'],['family','unknown_family','family']]) {
  test(`${name}: uncertain answer is selectable and gives a suitable result`, () => {
    assert.match(html, new RegExp(`name="${name}" value="${value}" required><span>分からない`));
    const answers = ['empty', 'clear', 'usable', 'none_management', 'keep', 'consult_sell'];
    answers[name === 'management' ? 3 : 4] = value;
    const selected = json.results.find(r => r[1].some(v => answers.includes(v))) || json.results.at(-1);
    assert.equal(selected[0], result);
  });
}
