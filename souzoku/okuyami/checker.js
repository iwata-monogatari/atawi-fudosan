/* 磐田おくやみ窓口 — 手続きチェッカー
   okuyami-data.json を読み込み、チェックした項目から
   「回る順路表」（窓口・電話・持ち物）を組み立てて表示する。
   コンテンツは一切ハードコードせず、すべて JSON から引く。 */
(function () {
  'use strict';

  var MOUNT = document.getElementById('checker');
  if (!MOUNT) return;

  var DATA = null;

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 電話番号の文字列から発信可能な数字だけを取り出す（「0538-37-4810（納付相談 …）」対策） */
  function telHref(tel) {
    var m = String(tel || '').match(/0\d[\d-]{7,}/);
    return m ? m[0].replace(/-/g, '') : null;
  }

  function telHtml(tel) {
    if (!tel) return '';
    var href = telHref(tel);
    if (!href) return '<span class="wtel">' + esc(tel) + '</span>';
    return '<a class="wtel" href="tel:' + esc(href) + '" data-track="cta_tel_click" data-cta="madoguchi">' + esc(tel) + '</a>';
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function linkHtml(link, cls) {
    if (!link || !link.url) return '';
    var ext = /^https?:/.test(link.url);
    return '<a class="' + (cls || '') + '" href="' + esc(link.url) + '"' +
      (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(link.label) + '</a>';
  }

  /* ------------------------------------------------------------------ */
  /* 入力フォーム                                                        */
  /* ------------------------------------------------------------------ */

  function renderForm() {
    var items = DATA.questions.map(function (q) {
      return '<label>' +
        '<input type="checkbox" value="' + esc(q.id) + '" data-q>' +
        '<span class="box">' + esc(q.label) +
        (q.highlight ? '<span class="hint">' + esc(q.highlight) + '</span>' : '') +
        '</span></label>';
    }).join('\n');

    MOUNT.innerHTML =
      '<form class="checker-form" id="checkerForm" novalidate>' +
        '<fieldset>' +
          '<legend>故人に当てはまるものを選んでください</legend>' +
          '<p class="checker-note" style="margin:0">分かる範囲で構いません。あとから選び直せます。</p>' +
          '<div class="check-list">' + items + '</div>' +
        '</fieldset>' +
        '<div class="checker-actions">' +
          '<button type="submit" class="btn btn-primary">順路表を作る</button>' +
          '<button type="button" class="btn btn-quiet" id="checkerReset">選び直す</button>' +
        '</div>' +
        '<p class="checker-note">結果はこの画面に表示されます。送信も保存もされません。</p>' +
      '</form>' +
      '<div class="checker-result" id="checkerResult" hidden aria-live="polite"></div>';

    document.getElementById('checkerForm').addEventListener('submit', function (e) {
      e.preventDefault();
      showResult(selected());
    });
    document.getElementById('checkerReset').addEventListener('click', function () {
      var boxes = MOUNT.querySelectorAll('input[data-q]');
      for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
      var out = document.getElementById('checkerResult');
      out.hidden = true;
      out.innerHTML = '';
      MOUNT.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selected() {
    var ids = [];
    var boxes = MOUNT.querySelectorAll('input[data-q]:checked');
    for (var i = 0; i < boxes.length; i++) ids.push(boxes[i].value);
    return ids.map(function (id) { return byId(DATA.questions, id); }).filter(Boolean);
  }

  /* ------------------------------------------------------------------ */
  /* 期限                                                                */
  /* ------------------------------------------------------------------ */

  function deadlineHtml(qs) {
    var out = [];
    DATA.deadlines.forEach(function (d) {
      var hit = d.always_show === true;
      if (!hit) {
        hit = qs.some(function (q) {
          return q.deadline === d.id || d.trigger_question === q.id;
        });
      }
      if (!hit) return;
      out.push(
        '<div class="deadline-alert">' +
          '<h3>期限があります：' + esc(d.label) + '</h3>' +
          '<p class="limit">' + esc(d.limit) + '</p>' +
          (d.note ? '<p>' + esc(d.note) + '</p>' : '') +
        '</div>'
      );
    });
    return out.join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* 窓口カード                                                          */
  /* ------------------------------------------------------------------ */

  /** 選択された質問を windows 単位にまとめ、buildings.order 順に並べ替える */
  function groupByBuilding(qs) {
    var perWindow = {};   // windowId -> {win, questions:[]}
    qs.forEach(function (q) {
      (q.windows || []).forEach(function (wid) {
        var w = byId(DATA.windows, wid);
        if (!w) return;
        if (!perWindow[wid]) perWindow[wid] = { win: w, questions: [] };
        perWindow[wid].questions.push(q);
      });
    });

    var buildings = DATA.buildings.slice().sort(function (a, b) { return a.order - b.order; });
    return buildings.map(function (b) {
      var wins = [];
      DATA.windows.forEach(function (w) {
        if (w.building === b.id && perWindow[w.id]) wins.push(perWindow[w.id]);
      });
      return { building: b, windows: wins };
    }).filter(function (g) { return g.windows.length > 0; });
  }

  function windowCardHtml(entry, showSoft) {
    var w = entry.win;
    var procs = [];
    var notes = [];
    var soft = '';

    entry.questions.forEach(function (q) {
      (q.procedures || []).forEach(function (p) {
        procs.push(
          '<div class="proc"><b>' + esc(p.name) + '</b>' +
            ((p.items && p.items.length)
              ? '<ul>' + p.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>'
              : '') +
          '</div>'
        );
      });
      if (q.note) notes.push('<p class="wnote">' + esc(q.note) + '</p>');
      if (showSoft && q.funnel && q.funnel.indexOf('soft_') === 0 && !soft) {
        var cta = DATA.funnel.cta_library[q.funnel];
        if (cta) {
          soft = '<p class="soft-link">' + esc(cta.text) + ' ' + linkHtml(cta.link) + '</p>';
        }
      }
    });

    return '<article class="window-card">' +
      '<span class="wname">' + esc(w.name) + '</span>' +
      telHtml(w.tel) +
      procs.join('') +
      notes.join('') +
      (w.alt ? '<p class="window-alt">' + esc(w.alt) + '</p>' : '') +
      soft +
    '</article>';
  }

  function routeHtml(qs, showSoft) {
    var groups = groupByBuilding(qs);
    if (!groups.length) return '';

    var blocks = groups.map(function (g) {
      return '<div class="building-block">' +
        '<h5>' + esc(g.building.name) +
          (g.building.address ? '<span class="addr">' + esc(g.building.address) + '</span>' : '') +
        '</h5>' +
        g.windows.map(function (e) { return windowCardHtml(e, showSoft); }).join('') +
      '</div>';
    }).join('');

    return '<section class="result-group">' +
      '<h4>市役所で回る窓口（この順に回ると移動が少なくなります）</h4>' +
      blocks +
    '</section>';
  }

  /* ------------------------------------------------------------------ */
  /* 市役所以外                                                          */
  /* ------------------------------------------------------------------ */

  function externalItemHtml(item) {
    return '<li><b>' + esc(item.label) + '</b>' +
      '<span class="contact">' + esc(item.contact) +
        (item.tel ? '　' + telHtml(item.tel) : '') +
      '</span>' +
      (item.note ? '<span class="note">' + esc(item.note) + '</span>' : '') +
    '</li>';
  }

  function relatedExternalHtml(qs) {
    var ids = [];
    qs.forEach(function (q) {
      (q.related_external || []).forEach(function (id) {
        if (ids.indexOf(id) === -1) ids.push(id);
      });
    });
    if (!ids.length) return '';

    var items = ids.map(function (id) {
      return byId(DATA.external_always_show.items, id);
    }).filter(Boolean);
    if (!items.length) return '';

    return '<section class="result-group">' +
      '<h4>あわせて必要になる、市役所以外の手続き</h4>' +
      '<ul class="external-list">' + items.map(externalItemHtml).join('') + '</ul>' +
    '</section>';
  }

  function externalFoldHtml() {
    var ex = DATA.external_always_show;
    return '<details class="fold no-print">' +
      '<summary>' + esc(ex.title) + '</summary>' +
      '<ul class="external-list">' + ex.items.map(externalItemHtml).join('') + '</ul>' +
    '</details>';
  }

  /* ------------------------------------------------------------------ */
  /* 導線（funnel）                                                      */
  /* ------------------------------------------------------------------ */

  function hasStrong(qs) {
    var trig = DATA.funnel.cta_library.result_strong.trigger || [];
    return qs.some(function (q) {
      return q.funnel === 'strong' || trig.indexOf(q.id) !== -1;
    });
  }

  function strongCardHtml() {
    var c = DATA.funnel.cta_library.result_strong;
    return '<aside class="funnel-strong">' +
      '<h4>' + esc(c.heading) + '</h4>' +
      '<p>' + esc(c.body) + '</p>' +
      '<div class="cta-actions">' +
        c.links.map(function (l, i) {
          return linkHtml(l, 'btn ' + (i === 0 ? 'btn-primary' : 'btn-secondary'));
        }).join('') +
      '</div>' +
    '</aside>';
  }

  function footerCtaHtml() {
    var c = DATA.funnel.cta_library.generic_footer;
    return '<aside class="funnel-footer no-print">' +
      '<h3>' + esc(c.heading) + '</h3>' +
      '<p>' + esc(c.body) + '</p>' +
      '<div class="cta-actions">' +
        c.links.map(function (l, i) {
          return linkHtml(l, 'btn ' + (i === 0 ? 'btn-primary' : 'btn-secondary'));
        }).join('') +
      '</div>' +
    '</aside>';
  }

  /* ------------------------------------------------------------------ */
  /* 結果の描画                                                          */
  /* ------------------------------------------------------------------ */

  function showResult(qs) {
    var out = document.getElementById('checkerResult');
    var strong = qs.length > 0 && hasStrong(qs);
    var body = [];

    body.push(deadlineHtml(qs));

    if (!qs.length) {
      body.push(
        '<section class="result-group">' +
          '<h4>まずは当てはまるものにチェックしてください</h4>' +
          '<p>チェックがない状態では、どなたにも共通する手続きだけを表示しています。' +
          '上の一覧から、故人に当てはまるものを選んで「順路表を作る」を押してください。</p>' +
          '<article class="window-card">' +
            '<span class="wname">' + esc(DATA.certificates.counter.name) + '</span>' +
            telHtml(DATA.certificates.counter.tel) +
            '<div class="proc"><b>死亡届の提出・戸籍や住民票の証明書の請求</b>' +
              '<ul><li>' + esc(DATA.certificates.intro) + '</li></ul></div>' +
          '</article>' +
        '</section>'
      );
    } else {
      body.push(routeHtml(qs, !strong));
      body.push(relatedExternalHtml(qs));
    }

    body.push(externalFoldHtml());
    if (strong) body.push(strongCardHtml());
    body.push(footerCtaHtml());

    out.innerHTML =
      '<div class="result-head">' +
        '<h3>あなたの順路表</h3>' +
        '<p>' + (qs.length ? esc(qs.length + '件の項目から作成しました。印刷して当日お持ちください。') :
                             '共通の手続きのみ表示しています。') + '</p>' +
      '</div>' +
      '<div class="result-body">' +
        body.filter(Boolean).join('\n') +
        '<div class="checker-actions no-print" style="margin-top:24px">' +
          '<button type="button" class="btn btn-secondary" id="checkerPrint">この順路表を印刷する</button>' +
        '</div>' +
        '<p class="source-note print-only">' + esc(DATA.meta.disclaimer) +
          '（出典：' + esc(DATA.meta.source.name) + ' ' + esc(DATA.meta.source.edition) +
          '／確認日 ' + esc(DATA.meta.source.confirmed_date) + '）</p>' +
      '</div>';

    out.hidden = false;
    document.getElementById('checkerPrint').addEventListener('click', function () {
      window.print();
    });
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------ */
  /* 起動                                                                */
  /* ------------------------------------------------------------------ */

  MOUNT.innerHTML = '<p class="checker-note">チェックリストを読み込んでいます…</p>';

  fetch('okuyami-data.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (json) {
      DATA = json;
      renderForm();
    })
    .catch(function () {
      MOUNT.innerHTML =
        '<p class="checker-note">チェックリストを読み込めませんでした。' +
        'お手数ですが、下の「市役所での手続き」「市役所以外の手続き」のページから直接ご確認ください。</p>';
    });
})();
