/*
 * Google広告のコンバージョン計測と、申込完了の二重計上防止。
 *
 * 背景 (2026-08-27):
 *   サイト全体に gtag('config','AW-18409604033') は入っていたが、
 *   コンバージョンを送る gtag('event','conversion',{send_to:...}) が1つも無かった。
 *   そのため広告アカウントは「コンバージョン0」のまま学習しており、入札最適化が効かない。
 *
 * 使い方:
 *   1) Google広告 > 目標 > コンバージョン で「ウェブサイト」のコンバージョンアクションを作る。
 *      推奨は3つ: カルテ申込 / LINE相談 / 電話タップ。
 *   2) 各アクションの「タグを自分で設定する」→ イベントスニペットに出る
 *      send_to: 'AW-18409604033/XXXXXXXXXXXXXXXXXXX' の "/" 以降のラベルを
 *      下の CONVERSION_LABELS に貼る。
 *   3) ラベルが空の項目は何も送らない。1つずつ有効化して構わない。
 *
 * このファイルは defer で読み込む。gtag 本体 (gtag.js) は各ページの <head> にある。
 */
(function () {
  'use strict';

  var AW_ID = 'AW-18409604033';

  // ← ここにラベルを貼る。空文字のままなら、その種別は送信しない。
  var CONVERSION_LABELS = {
    apply: '',  // ふじがおか実家カルテの申込完了 (/karte/thanks/ 到達)
    line: '',   // LINE相談ボタンのクリック
    tel: 'QQRMCPqO7egcEMGHscpE' // 電話番号 (0538-31-3308) のタップ
  };

  var SUBMIT_KEY = 'fgaKarteSubmit';
  var SUBMIT_MAX_AGE_MS = 30 * 60 * 1000;
  var THANKS_PATH = '/karte/thanks/';

  var sent = {};

  function sessionStore() {
    try {
      var store = window.sessionStorage;
      if (!store) return null;
      // Safari のプライベートモード等では setItem が例外を投げることがある。
      var probe = '__fga_probe__';
      store.setItem(probe, '1');
      store.removeItem(probe);
      return store;
    } catch (e) {
      return null;
    }
  }

  /**
   * 申込フォームが送信に成功したときに呼ぶ。
   * /karte/thanks/ 側でこの印を消費することで、
   * リロードや直接アクセスをコンバージョンとして数えないようにする。
   */
  window.fgaMarkKarteSubmit = function () {
    var store = sessionStore();
    if (!store) return;
    try {
      store.setItem(SUBMIT_KEY, String(Date.now()));
    } catch (e) {
      /* 保存できなくても送信自体は妨げない */
    }
  };

  /**
   * 'valid'       … 直前に申込送信があった (数える)
   * 'missing'     … 印が無い。リロード・ブックマーク・直接アクセス (数えない)
   * 'unavailable' … sessionStorage が使えない。取りこぼしを避けるため数える
   */
  function consumeSubmitMark() {
    var store = sessionStore();
    if (!store) return 'unavailable';
    var raw = null;
    try {
      raw = store.getItem(SUBMIT_KEY);
      store.removeItem(SUBMIT_KEY);
    } catch (e) {
      return 'unavailable';
    }
    if (!raw) return 'missing';
    var at = Number(raw);
    if (!isFinite(at) || Date.now() - at > SUBMIT_MAX_AGE_MS) return 'missing';
    return 'valid';
  }

  function fireConversion(kind) {
    if (sent[kind]) return;
    var label = CONVERSION_LABELS[kind];
    if (!label) return;              // ラベル未設定のうちは何も送らない
    if (typeof window.gtag !== 'function') return;
    sent[kind] = true;
    window.gtag('event', 'conversion', { send_to: AW_ID + '/' + label });
  }

  window.fgaAdsConversion = fireConversion;

  // --- 申込完了 -------------------------------------------------------------
  // /karte/thanks/ には5つのフォーム (トップ・/karte/・/kaigo-jikka/・
  // /from-shrine/・/from-temple/) が全てリダイレクトしてくる。
  function currentPathIsThanks() {
    var path = window.location.pathname;
    if (path.charAt(path.length - 1) !== '/') path += '/';
    return path === THANKS_PATH;
  }

  if (currentPathIsThanks()) {
    var state = consumeSubmitMark();
    window.fgaKarteSubmitState = state;
    if (state !== 'missing') {
      fireConversion('apply');
    }
  }

  // --- LINE・電話 -----------------------------------------------------------
  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      fireConversion('tel');
    } else if (href.indexOf('line.me') !== -1 || href.indexOf('lin.ee') !== -1) {
      fireConversion('line');
    }
  }, true);
})();
