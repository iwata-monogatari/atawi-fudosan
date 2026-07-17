/* ふじがおか実家カルテ｜診断エンジン
   window.DIAG（各ページのconfig）を読み込み、intro→設問→結果を描画する。
   設問は現状の.info版と同等の入力量（約6問・3択中心／数値・複数選択も可）。
   結果は多次元スコア＋パーソナライズ分析＋優先アクション＋関連導線を描画する。 */
(function(){
  'use strict';
  var D = window.DIAG;
  if(!D){ return; }
  var TEL = '0538-31-3308';
  var LINE = 'https://line.me/R/ti/p/%40531nwfsc';
  var root = document.getElementById('diag-root');
  var answers = {};   // qid -> value (choice: index; multi: array of indices; number: number)
  var idx = 0;

  function h(tag, attrs, html){
    var e = document.createElement(tag);
    if(attrs){ for(var k in attrs){ if(k==='class') e.className=attrs[k]; else if(k==='html') e.innerHTML=attrs[k]; else e.setAttribute(k, attrs[k]); } }
    if(html!=null) e.innerHTML = html;
    return e;
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function track(name){ try{ if(window.fgaTrack) window.fgaTrack(name); if(window.gtag) window.gtag('event',name); }catch(e){} }
  function yen(n){ return '約' + Math.round(n).toLocaleString('ja-JP') + '円'; }
  D.yen = yen;

  /* ---------- scoring ---------- */
  function scores(){
    var s = {};
    D.questions.forEach(function(q){
      var a = answers[q.id];
      if(a==null) return;
      if(q.type==='number'){ if(q.score) q.score(a, s); return; }
      if(q.type==='multi'){
        (a||[]).forEach(function(i){ var o=q.options[i]; if(o&&o.s) for(var k in o.s){ s[k]=(s[k]||0)+o.s[k]; } });
        return;
      }
      var o = q.options[a];
      if(o&&o.s) for(var k in o.s){ s[k]=(s[k]||0)+o.s[k]; }
    });
    return s;
  }

  /* ---------- INTRO ---------- */
  function renderIntro(){
    var el = h('div', {class:'intro'});
    var hero = h('div', {class:'intro-hero'});
    hero.appendChild(h('span',{class:'badge'}, esc(D.badge||'無料診断')));
    hero.appendChild(h('h1', null, esc(D.title)));
    hero.appendChild(h('p',{class:'lead'}, esc(D.lead||'')));
    el.appendChild(hero);

    if((D.forWhom&&D.forWhom.length)||(D.reveals&&D.reveals.length)){
      var cols = h('div',{class:'intro-cols'});
      if(D.forWhom&&D.forWhom.length){
        var b1=h('div',{class:'box'});
        b1.appendChild(h('h3',null,'<span class="ic">🙋</span>こんな方におすすめ'));
        var u1=h('ul'); D.forWhom.forEach(function(t){ u1.appendChild(h('li',null,esc(t))); }); b1.appendChild(u1);
        cols.appendChild(b1);
      }
      if(D.reveals&&D.reveals.length){
        var b2=h('div',{class:'box reveal'});
        b2.appendChild(h('h3',null,'<span class="ic">🔎</span>この診断でわかること'));
        var u2=h('ul'); D.reveals.forEach(function(t){ u2.appendChild(h('li',null,esc(t))); }); b2.appendChild(u2);
        cols.appendChild(b2);
      }
      el.appendChild(cols);
    }
    var sw = h('div',{class:'start-wrap'});
    var btn = h('button',{class:'btn btn-sun'}, '診断を始める（'+ (D.questions.length) +'問）');
    btn.addEventListener('click', function(){ track('diag_start_'+D.slug); idx=0; renderQuestion(); window.scrollTo(0,0); });
    sw.appendChild(btn);
    sw.appendChild(h('p',{class:'start-note'}, '入力は'+(D.badge||'')+'。わかる範囲でOK・登録不要。無理な売却営業はいたしません。'));
    el.appendChild(sw);
    swap(el);
  }

  /* ---------- QUESTION ---------- */
  function renderQuestion(){
    var q = D.questions[idx];
    var el = h('div',{class:'q-stage active'});
    // progress
    var pr = h('div',{class:'progress'});
    var pct = Math.round((idx)/D.questions.length*100);
    pr.innerHTML = '<div class="bar"><div class="fill" style="width:'+pct+'%"></div></div>'+
                   '<div class="lbl">設問 '+(idx+1)+' / '+D.questions.length+'</div>';
    el.appendChild(pr);

    var card = h('div',{class:'card q-card'});
    card.appendChild(h('div',{class:'q-num'},'Q'+(idx+1)));
    card.appendChild(h('div',{class:'q-text'}, esc(q.text)));
    if(q.help) card.appendChild(h('div',{class:'q-help'}, esc(q.help)));

    var needNext = false;
    if(q.type==='number'){
      needNext = true;
      var wrap=h('div',{class:'q-number'});
      var field=h('div',{class:'field'});
      var inp=h('input',{type:'number',inputmode:'numeric',placeholder:(q.placeholder||''),value:(answers[q.id]!=null?answers[q.id]:'')});
      field.appendChild(inp);
      if(q.unit) field.appendChild(h('span',{class:'unit'},esc(q.unit)));
      wrap.appendChild(field);
      if(q.hint) wrap.appendChild(h('div',{class:'hint'},esc(q.hint)));
      inp.addEventListener('input', function(){ answers[q.id]= inp.value===''?null:Number(inp.value); updateNext(); });
      card.appendChild(wrap);
    } else if(q.type==='multi'){
      needNext = true;
      var cur = answers[q.id]||[];
      var opts=h('div',{class:'opts'});
      q.options.forEach(function(o,i){
        var on = cur.indexOf(i)>=0;
        var b=h('button',{class:'opt multi'+(on?' sel':''),type:'button'});
        b.innerHTML='<span class="tick">✓</span><span class="lab">'+esc(o.label)+'</span>';
        b.addEventListener('click',function(){
          var arr=answers[q.id]||[]; var p=arr.indexOf(i);
          if(p>=0) arr.splice(p,1); else arr.push(i);
          answers[q.id]=arr; b.classList.toggle('sel'); updateNext();
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
    } else {
      var opts2=h('div',{class:'opts'});
      q.options.forEach(function(o,i){
        var on = answers[q.id]===i;
        var b=h('button',{class:'opt'+(on?' sel':''),type:'button'});
        b.innerHTML='<span class="tick">✓</span><span class="lab">'+esc(o.label)+'</span>';
        b.addEventListener('click',function(){
          answers[q.id]=i;
          [].forEach.call(opts2.children,function(c){c.classList.remove('sel');});
          b.classList.add('sel');
          setTimeout(next, 180);
        });
        opts2.appendChild(b);
      });
      card.appendChild(opts2);
    }

    var nav=h('div',{class:'q-nav'});
    var back=h('button',{class:'q-back',type:'button'}, idx===0?'← 説明に戻る':'← 前の質問');
    back.addEventListener('click', prev);
    nav.appendChild(back);
    if(needNext){
      var nx=h('button',{class:'btn btn-navy q-next',type:'button'}, idx===D.questions.length-1?'結果を見る':'次へ');
      nx.addEventListener('click', next);
      nav.appendChild(nx);
    }
    card.appendChild(nav);
    el.appendChild(card);
    swap(el);

    function updateNext(){
      if(!needNext) return;
      var ok = q.type==='number' ? (answers[q.id]!=null) : ((answers[q.id]||[]).length>0 || q.optional);
      if(nx) nx.disabled = !ok;
    }
    updateNext();
  }
  function next(){
    var q=D.questions[idx];
    if(q.type==='choice' && answers[q.id]==null) return;
    if(idx < D.questions.length-1){ idx++; renderQuestion(); window.scrollTo(0,0); }
    else { renderResult(); window.scrollTo(0,0); }
  }
  function prev(){
    if(idx===0){ renderIntro(); } else { idx--; renderQuestion(); }
    window.scrollTo(0,0);
  }

  /* ---------- RESULT ---------- */
  function lvClass(l){ return l==='high'?'lv-high':l==='mid'?'lv-mid':l==='ok'?'lv-ok':'lv-info'; }
  function tagClass(l){ return l==='high'?'high':l==='mid'?'mid':'ok'; }

  function renderResult(){
    track('diag_result_'+D.slug);
    var s = scores();
    var ctx = {
      a: answers,
      s: s,
      get: function(qid){ return answers[qid]; },
      opt: function(qid){ var q=D.questions.filter(function(x){return x.id===qid;})[0]; return q&&q.options?q.options[answers[qid]]:null; },
      sum: function(){ var t=0; for(var i=0;i<arguments.length;i++){ t += (s[arguments[i]]||0);} return t; },
      val: function(k,d){ return s[k]!=null?s[k]:(d||0); },
      yen: yen
    };
    var R = D.result(ctx) || {};
    var el = h('div',{class:'result active'});

    /* hero */
    var hero = h('div',{class:'res-hero '+lvClass(R.level)});
    hero.appendChild(h('div',{class:'kicker'}, esc(R.kicker||D.title+'の結果')));
    hero.appendChild(h('div',{class:'level'}, R.headline||''));
    if(R.bignum) hero.appendChild(h('div',{class:'res-bignum'}, esc(R.bignum)));
    if(R.headSub) hero.appendChild(h('div',{class:'head-sub', html: R.headSub}));
    if(R.gauge){
      var g=h('div',{class:'gauge'});
      var p=Math.max(3,Math.min(100, Math.round(R.gauge.value/(R.gauge.max||100)*100)));
      g.innerHTML='<div class="track"><div class="val" style="width:'+p+'%"></div></div>'+
        '<div class="glab"><span>'+esc(R.gauge.minLabel||'低')+'</span><span>'+esc(R.gauge.maxLabel||'高')+'</span></div>';
      hero.appendChild(g);
    }
    el.appendChild(hero);

    /* summary */
    if(R.summary&&R.summary.length){
      var sec=h('div',{class:'res-sec summary'});
      sec.appendChild(h('h2',null,'<span class="ic">🧭</span>あなたの状況の読み解き'));
      var c=h('div',{class:'card'});
      R.summary.forEach(function(p){ c.appendChild(h('p',null,p)); });
      sec.appendChild(c); el.appendChild(sec);
    }
    /* dimensions */
    if(R.dims&&R.dims.length){
      var sec2=h('div',{class:'res-sec'});
      sec2.appendChild(h('h2',null,'<span class="ic">📊</span>多面的に見ると'));
      var box=h('div',{class:'dims'});
      R.dims.forEach(function(d){
        var t=tagClass(d.level), p=Math.max(5,Math.min(100,d.pct!=null?d.pct:(d.level==='high'?88:d.level==='mid'?55:22)));
        var el2=h('div',{class:'dim'});
        el2.innerHTML='<div class="top"><span class="name">'+esc(d.name)+'</span><span class="tag '+t+'">'+esc(d.tag||(d.level==='high'?'要注意':d.level==='mid'?'注意':'良好'))+'</span></div>'+
          '<div class="track"><div class="fill '+t+'" style="width:'+p+'%"></div></div>'+
          '<div class="note">'+d.note+'</div>';
        box.appendChild(el2);
      });
      sec2.appendChild(box); el.appendChild(sec2);
    }
    /* scenarios */
    if(R.scenarios&&R.scenarios.length){
      var sec5=h('div',{class:'res-sec'});
      sec5.appendChild(h('h2',null,'<span class="ic">⚖️</span>選択肢を比べると'));
      var box5=h('div',{class:'scenarios'});
      R.scenarios.forEach(function(sc){
        var el5=h('div',{class:'scenario'+(sc.pick?' pick':'')});
        el5.innerHTML='<div class="st"><h3>'+esc(sc.title)+'</h3><span class="verdict">'+esc(sc.verdict||'')+'</span></div><p>'+sc.body+'</p>';
        box5.appendChild(el5);
      });
      sec5.appendChild(box5); el.appendChild(sec5);
    }
    /* insights */
    if(R.insights&&R.insights.length){
      var sec3=h('div',{class:'res-sec'});
      sec3.appendChild(h('h2',null,'<span class="ic">💡</span>見落としがちな視点'));
      var box3=h('div',{class:'insights'});
      R.insights.forEach(function(i){
        var el3=h('div',{class:'insight'});
        el3.innerHTML='<span class="ic">'+esc(i.icon||'•')+'</span><h3>'+esc(i.title)+'</h3><p>'+i.body+'</p>';
        box3.appendChild(el3);
      });
      sec3.appendChild(box3); el.appendChild(sec3);
    }
    /* actions */
    if(R.actions&&R.actions.length){
      var sec4=h('div',{class:'res-sec'});
      sec4.appendChild(h('h2',null,'<span class="ic">✅</span>次の一手（優先順）'));
      var box4=h('div',{class:'actions'});
      R.actions.forEach(function(a){
        var tag = a.when==='now'?'<span class="tag now">まず着手</span>':a.when==='soon'?'<span class="tag soon">近いうちに</span>':'<span class="tag later">落ち着いたら</span>';
        var link = a.href?'　<a href="'+esc(a.href)+'">'+esc(a.linkText||'詳しく')+'</a>':'';
        var el4=h('div',{class:'action'});
        el4.innerHTML='<div class="n"></div><div class="body">'+tag+'<h3>'+esc(a.title)+'</h3><p>'+a.body+link+'</p></div>';
        box4.appendChild(el4);
      });
      sec4.appendChild(box4); el.appendChild(sec4);
    }
    /* caveats */
    if(R.caveats&&R.caveats.length){
      var sec6=h('div',{class:'res-sec'});
      var ul=h('ul',{class:'caveats'});
      R.caveats.forEach(function(c){ ul.appendChild(h('li',null,c)); });
      sec6.appendChild(ul); el.appendChild(sec6);
    }
    /* related */
    var rel = (R.related&&R.related.length)?R.related:defaultRelated();
    var sec7=h('div',{class:'res-sec'});
    sec7.appendChild(h('h2',null,'<span class="ic">📎</span>あわせて読みたい'));
    var box7=h('div',{class:'related'});
    rel.forEach(function(r){
      var a=h('a',{href:r.href});
      a.innerHTML='<span class="ic">'+esc(r.icon||'📄')+'</span><span class="tx"><b>'+esc(r.label)+'</b><span>'+esc(r.sub||'')+'</span></span>';
      box7.appendChild(a);
    });
    sec7.appendChild(box7); el.appendChild(sec7);

    /* CTA */
    var cta=h('div',{class:'cta-block'});
    cta.innerHTML =
      '<h2>'+esc(R.ctaTitle||'この結果をもとに、無料でカルテを作れます。')+'</h2>'+
      '<p>'+(R.ctaBody||'住所を送るだけで、宅建士がこの家に関係する項目だけを机上調査し、次にやることの順番まで1冊に整理します。作成料0円。査定ではないので価格は出ません。')+'</p>'+
      '<div class="btns">'+
        '<a class="btn btn-sun" href="/karte/" onclick="try{fgaTrack&&fgaTrack(\'diag_cta_karte\')}catch(e){}">実家カルテを申し込む（無料）</a>'+
        '<a class="btn btn-line" href="'+LINE+'" onclick="try{fgaTrack&&fgaTrack(\'line_click\')}catch(e){}">LINEで相談する</a>'+
      '</div>'+
      '<p class="tel"><a href="tel:'+TEL+'">'+TEL+'</a></p>'+
      '<p class="hours">受付 9:00〜17:00・定休日なし／磐田市・袋井市・掛川市・森町・浜松市一部</p>';
    el.appendChild(cta);

    /* footer nav */
    var rf=h('div',{class:'res-foot'});
    var again=h('button',null,'↻ もう一度診断する');
    again.addEventListener('click',function(){ answers={}; idx=0; renderIntro(); window.scrollTo(0,0); });
    rf.appendChild(again);
    rf.appendChild(h('a',{href:'/shindan/'},'← 20の診断一覧へ'));
    el.appendChild(rf);

    swap(el);
  }

  function defaultRelated(){
    return [
      {icon:'📋',label:'ふじがおか実家カルテ',sub:'住所から60項目超を机上調査',href:'/karte/'},
      {icon:'🧹',label:'実家じまい・空き家相談室',sub:'荷物・建物・管理・気持ち',href:'/jikka/'},
      {icon:'🧾',label:'相続はじめ・空き家相談室',sub:'名義・登記・意向・税金',href:'/souzoku/'},
      {icon:'🔎',label:'20の無料診断一覧',sub:'ほかの角度からも確かめる',href:'/shindan/'}
    ];
  }

  function swap(el){ root.innerHTML=''; root.appendChild(el); }
  renderIntro();
})();
