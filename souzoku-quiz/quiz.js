'use strict';
const app = document.getElementById('app');
let kind = null, index = 0, answers = [], concern = null;
let view = 'start', started = false, completed = false;
const STORAGE_KEY = 'fga.souzokuQuiz.v1';
function track(event) {
  if (location.hostname !== 'fudosan.atawi.link') return;
  try { window.fgaTrack?.(event, {feature:'souzoku_quiz'}); } catch (_) {}
}
function persist() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({kind,index,answers,concern,view,started,completed})); } catch (_) {}
}
function restore() {
  try {
    const saved = validateQuizState(JSON.parse(sessionStorage.getItem(STORAGE_KEY)));
    if (!saved) { sessionStorage.removeItem(STORAGE_KEY); return; }
    ({kind,index,answers,concern,view,started,completed} = saved);
  } catch (_) {}
}
const advisor = message => `<div class="advisor"><span class="avatar"><img src="oishi-source.jpg" alt="ナビゲーター 大石浩之" width="752" height="200"></span><div><p class="advisor-name">ナビゲーター｜富士ヶ丘サービス 大石浩之</p><p class="advisor-message">${message}</p></div></div>`;
const sourcesHtml = keys => `<div class="source-links">${keys.map(key => `<a href="${SOURCES[key][1]}" target="_blank" rel="noopener noreferrer">${SOURCES[key][0]} ↗</a>`).join('')}</div>`;

function focusTitle() {
  const heading = app.querySelector('h1,h2');
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({preventScroll:true}); }
  app.scrollIntoView({behavior:'auto', block:'start'});
}

function showStart() {
  kind=null; index=0; answers=[]; concern=null; view='start'; started=false; completed=false;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  app.innerHTML = `<div class="intro"><svg class="house-mark" viewBox="0 0 90 76" aria-hidden="true"><path d="M5 37 43 8l39 29" fill="none" stroke="#0876ad" stroke-width="5" stroke-linecap="round"/><path d="M15 32v37h57V32" fill="#eaf8ff" stroke="#0876ad" stroke-width="3"/><path d="M35 68V45h17v23" fill="#f2b705"/><path d="M3 72h83" stroke="#14344a" stroke-width="2"/></svg><p class="kicker">相続した家・土地のこと</p><h1>売る？ 貸す？ 残す？<br>まず、考える順番から。</h1><p>6問のクイズで、相続後に確認したいことを一つずつ。<br>正解が分からなくても、その場で解説を読めます。</p><p class="small">無料・登録不要。結果を見るための連絡先入力もありません。</p></div>
  <section class="card" aria-labelledby="start-title"><h2 id="start-title">どちらについて考えていますか？</h2><div class="choices"><button class="choice" data-kind="house"><span class="letter">家</span><span><strong>戸建て・古家付きの土地</strong><small>建物や荷物が残っている方</small></span></button><button class="choice" data-kind="land"><span class="letter">地</span><span><strong>土地・更地</strong><small>建物がない土地について考えたい方</small></span></button></div><p class="small" style="margin:18px 0 0">両方をお持ちの方は、先に確認したい方からどうぞ。</p></section><p class="small">読み終わると、家族と話すための確認メモが手元に残ります。申込みをせずに読むだけでも大丈夫です。</p>`;
  app.querySelector('.house-mark')?.remove();
  app.querySelector('.intro').insertAdjacentHTML('afterbegin', advisor('こんにちは、大石です。<br>売るか残すかを決める前に、考える順番を一緒に確認しましょう。'));
  app.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
    kind = button.dataset.kind; index = 0; answers = []; concern = null; started = true; track('souzoku_quiz_start'); showQuestion();
  }));
}

function showQuestion() {
  view = 'question'; persist();
  const sequence = questionsFor(kind), q = sequence[index], selected = answers[index];
  const answered = Number.isInteger(selected);
  app.innerHTML = `<div class="progress-head"><span>${kind === 'house' ? '戸建て・古家付きの土地' : '土地・更地'}</span><span>第${index + 1}問 / 全${sequence.length}問</span></div><div class="progress" role="progressbar" aria-label="回答済みの問題" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${answers.length}"><span style="width:${answers.length / sequence.length * 100}%"></span></div>
  <section class="card"><p class="kicker">${q.topic}</p><h1 class="question-title">${q.question}</h1><div class="choices" role="group" aria-label="回答を選ぶ">${q.options.map((option, i) => `<button class="choice ${selected === i ? 'selected' : ''} ${answered && q.correct === i ? 'correct' : ''}" data-answer="${i}" ${answered ? 'disabled' : ''}><span class="letter">${String.fromCharCode(65 + i)}</span><span>${option}${answered && q.correct === i ? '　✓ 正解' : ''}${selected === i ? '（あなたの回答）' : ''}</span></button>`).join('')}</div>
  ${answered ? `<section class="feedback" aria-label="答えと解説"><p class="judge">${selected === q.correct ? '正解です。' : 'ここで、一緒に確認しましょう。'}</p><h2>${q.answer}</h2><p>${q.explanation}</p><div class="action"><b>次にできること</b><p>${q.action}</p></div><details><summary>補足と確認先</summary><p>${q.detail}</p>${sourcesHtml(q.sources)}</details></section>` : ''}
  <div class="navigation"><button class="secondary" id="back">${index === 0 ? '種類を選び直す' : '前の問題へ'}</button>${answered ? `<button class="primary" id="next">${index === sequence.length - 1 ? 'まとめを見る' : '次の問題へ'} →</button>` : ''}</div>${answered ? '<button class="text-button" id="revise">この問題を答え直す</button>' : ''}</section><p class="small">すべての問題で解説を読めます。正解数によって売却や活用を勧めることはありません。</p>`;
  app.querySelector('.card').insertAdjacentHTML('afterbegin', advisor(`第${index + 1}問です。近いと思う答えを選んでみてください。`));
  if (answered) app.querySelector('.feedback').insertAdjacentHTML('afterbegin', '<p class="advisor-name">大石からの解説</p>');
  app.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
    answers[index] = Number(button.dataset.answer); answers = answers.slice(0, index + 1); showQuestion();
    const feedback = app.querySelector('.feedback'); feedback.setAttribute('tabindex', '-1'); feedback.focus({preventScroll:true}); feedback.scrollIntoView({behavior:'auto',block:'nearest'});
  }));
  app.querySelector('#back').addEventListener('click', () => {
    if (index === 0) { showStart(); focusTitle(); } else { index--; showQuestion(); }
  });
  app.querySelector('#next')?.addEventListener('click', () => {
    if (index === sequence.length - 1) showResult(); else { index++; showQuestion(); }
  });
  app.querySelector('#revise')?.addEventListener('click', () => { answers = answers.slice(0,index); showQuestion(); });
  focusTitle();
}

function concernHtml() {
  if (concern === null) return '<p class="small">選ばなくても、上の確認メモを利用できます。</p>';
  const item = CONCERNS.find(value => value.id === concern);
  let text = item.text, href = item.href, link = item.link;
  if (kind === 'land' && concern === 'use') {href = 'https://fudosan.atawi.link/souzoku/'; link = '土地の確認事項を読む';}
  if (kind === 'land' && concern === 'cost') {text = '測量、整地、草刈りなどの必要性と、費用の負担者を確認します。先に工事を始めず、道路・境界・法令上の条件と、売却や活用の見込みを並べましょう。'; href='https://fudosan.atawi.link/karte/';link='実家カルテの内容を見る';}
  return `<div class="action"><b>気になることから始めるなら</b><h3>${item.title}</h3><p>${text}</p><a href="${href}" target="_blank" rel="noopener noreferrer">${link} ↗</a></div>`;
}

function resultText() {
  const sequence = questionsFor(kind);
  return ['相続した家・土地の確認メモ', `対象：${kind === 'house' ? '戸建て・古家付きの土地' : '土地・更地'}`, '無料・登録不要｜富士ヶ丘サービス', '', ...sequence.flatMap((q,i) => [`${i+1}. ${q.topic}`,q.answer,`次にできること：${q.action}`,...q.sources.map(key => `${SOURCES[key][0]}：${SOURCES[key][1]}`), '']), '期限のある手続きと安全・管理の確認は、売るか残すかの結論を待たずに進めます。', 'このメモは一般情報です。個別の税額・権利・物件の判断は専門家に確認してください。', '制度の確認日：2026-10-12', '実家カルテ：https://fudosan.atawi.link/karte/', '売却の進め方を3問で確認：https://baikyaku.atawi.link/?entry=souzoku-quiz#sale-check'].join('\n');
}

function showResult() {
  view = 'result';
  if (!completed) { completed = true; track('souzoku_quiz_complete'); }
  persist();
  const sequence = questionsFor(kind), wrong = sequence.filter((q,i) => answers[i] !== q.correct);
  app.innerHTML = `<div class="result-top"><span class="pill">6問の確認が終わりました</span><h1 style="margin-top:20px">この家・土地のこと、<br>次はこの順番で。</h1><p>今すぐ結論を出す必要はありません。<br>確認できたことから、家族で進め方を考えましょう。</p></div>
  <section class="card"><h2>家族と話すための確認メモ</h2><ol class="result-steps"><li><b>名義・期限・安全を確認する</b>所有者、相続人、手続きの期限、今の管理状態を整理。</li><li><b>家・土地の条件と、家族の希望を集める</b>${kind === 'house' ? '建物、荷物、道路、境界。片付けや解体にお金をかける前に確認。' : '道路、境界、地目、法令上の条件。整備にお金をかける前に確認。'}</li><li><b>売る・貸す・残すを、同じ条件で比べる</b>価格・費用・税金・時間・管理負担・将来の使い道を並べる。</li></ol><p class="small">相続放棄や相続税など、登記より短い期限の手続きもあります。結論を保留する間も、必要な期限と管理を確認してください。</p><div class="links no-print"><button class="secondary" id="save">確認メモを保存</button><button class="secondary" id="print">まとめを印刷</button></div></section>
  <section class="card"><h2>もう一度読める解説</h2><p class="small">${wrong.length ? `今回確認したいポイントが${wrong.length}つありました。各問題の解説を読み直せます。` : '6問とも正解でした。実際の物件については、資料を確認して進めましょう。'}</p>${sequence.map((q,i) => `<details><summary>${i+1}. ${q.topic}${answers[i] !== q.correct ? '（もう一度確認）' : ''}</summary><p><b>${q.answer}</b></p><p>${q.explanation}</p><p>${q.detail}</p><p><b>次に：</b>${q.action}</p>${sourcesHtml(q.sources)}</details>`).join('')}</section>
  <section class="card"><h2>今、気になることはありますか？</h2><p class="small">選択は任意です。近い内容を選ぶと、最初の一歩を表示します。</p><div class="concerns no-print">${CONCERNS.map(item => `<button class="choice ${concern === item.id ? 'selected' : ''}" aria-pressed="${concern === item.id}" data-concern="${item.id}">${kind==='land'&&item.id==='cost'?'整備や費用が気になる':item.label}</button>`).join('')}</div><div id="concern-content" aria-live="polite">${concernHtml()}</div></section>
  <section class="card"><p class="kicker">具体的な家・土地について相談したい方へ</p><h2>価格の目安・課題・次にすることを、実家カルテに。</h2><p>売ると決めていなくても大丈夫です。富士ヶ丘サービスが、物件の情報から判断材料を整理します。</p><a class="primary yellow no-print" href="https://fudosan.atawi.link/karte/" target="_blank" rel="noopener noreferrer">無料の実家カルテの内容を見る ↗</a><p class="small" style="margin-top:16px">カルテの申込みを希望する場合に、別ページで物件所在地と連絡先を伺います。クイズの結果を見るための申込みは不要です。申込みだけで売却依頼にはなりません。</p><p class="small">カルテの対象：磐田市・袋井市・森町・掛川市・菊川市・御前崎市・湖西市・浜松市の物件。クイズは地域を問わず読めます。</p></section>
<section class="card quiz-sale-card no-print" aria-labelledby="quiz-sale-title"><p class="kicker">富士ヶ丘サービス｜ATAWI 不動産売却相談室</p><h2 id="quiz-sale-title">売却も考えている方へ</h2><p>3つの質問で、この家・土地の売却の進め方と、先に確認したいことを整理できます。無料・登録不要です。</p><a class="primary" id="sale-check-link" href="https://baikyaku.atawi.link/?entry=souzoku-quiz#sale-check">3問で売却の進め方を確認する ›</a><p class="small" style="margin-top:16px">同じ富士ヶ丘サービスが運営する売却相談室へ進みます。回答だけで相談が送信されることはありません。</p></section>
  <div class="navigation no-print"><button class="secondary" id="last">最後の問題へ戻る</button><button class="text-button" id="restart">最初から確認する</button></div>`;
  app.querySelector('.result-top').insertAdjacentHTML('afterbegin', advisor('おつかれさまでした。<br>次に確認することを、ご家族と話すためのメモにまとめました。'));
  app.querySelectorAll('[data-concern]').forEach(button => button.addEventListener('click', () => {
    concern = button.dataset.concern; persist();
    app.querySelectorAll('[data-concern]').forEach(el => {el.classList.toggle('selected', el.dataset.concern === concern);el.setAttribute('aria-pressed', String(el.dataset.concern === concern));});
    app.querySelector('#concern-content').innerHTML = concernHtml();
  }));
  app.querySelector('#sale-check-link').addEventListener('click', () => { persist(); track('souzoku_quiz_sale_click'); });
  app.querySelector('#save').addEventListener('click', () => {
    track('souzoku_quiz_memo_save');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + resultText()], {type:'text/plain;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url;anchor.download='相続した家・土地の確認メモ.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  app.querySelector('#print').addEventListener('click', () => window.print());
  app.querySelector('#last').addEventListener('click', () => {index=5;showQuestion();});
  app.querySelector('#restart').addEventListener('click', () => {kind=null;index=0;answers=[];concern=null;showStart();focusTitle();});
  focusTitle();
}
restore();
if (view === 'result') showResult(); else if (view === 'question') showQuestion(); else showStart();
