/* Mori referral context: fixed codes only; never persist contact/address values. */
(function () {
  'use strict';
  var KEY = 'mori_intake_v1', RECEIPT = 'mori_intake_receipt_v1', CAMPAIGN = 'mori_jikka_20261018';
  var entries = ['home_sale','hub_top','hub_sample','hub_organize','hub_sale','hub_bottom','hub_bottom_sale','sell_top','sell_bottom','sell_bottom_organize'];
  ['inherited_house','sell_house'].forEach(function (page) { ['early','bottom','mobile'].forEach(function (placement) {
    ['', '_sample', '_sale'].forEach(function (suffix) { entries.push(page + '_' + placement + suffix); });
  }); });
  function valid(value) { return value && value.campaign === CAMPAIGN && entries.indexOf(value.entry) !== -1 && ['sale','organize'].indexOf(value.intent) !== -1; }
  function read(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function save(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function remove(key) { try { sessionStorage.removeItem(key); } catch (_) {} }
  var p = new URLSearchParams(location.search), context = null, isThanks = location.pathname === '/karte/thanks/';
  if (p.get('utm_source') === 'morimachi_lifehack' && p.get('utm_campaign') === CAMPAIGN) {
    var incoming = { campaign: CAMPAIGN, entry: p.get('utm_content'), intent: p.get('intent') || 'organize', at: Date.now() };
    if (valid(incoming)) { context = incoming; save(KEY, context); }
    else remove(KEY);
  } else if (p.has('utm_source') || p.has('utm_campaign')) {
    remove(KEY);
  } else {
    var stored = read(KEY);
    if (valid(stored) && Date.now() - stored.at >= 0 && Date.now() - stored.at < 30 * 60 * 1000) context = stored;
    else remove(KEY);
  }
  var seen = {};
  function track(stage) {
    if (!context || seen[context.intent + '_' + stage] || !window.fgaMeasurement) return;
    if (['form_view','form_start','accepted','submit_error'].indexOf(stage) === -1) return;
    seen[context.intent + '_' + stage] = true;
    window.fgaMeasurement.track('mori_jikka_' + context.intent + '_' + stage);
  }
  function active() { var city = document.getElementById('city'); return context && (!city || city.value === '森町'); }
  function buttonText() { return active() && context.intent === 'sale' ? 'この内容で売却を相談する' : 'この内容で実家カルテを依頼する'; }
  function update() {
    var box = document.getElementById('moriIntakeContext');
    if (!box) return;
    box.hidden = !active();
    var sale = active() && context.intent === 'sale';
    document.getElementById('applyHeading').textContent = sale ? '森町の実家・土地の売却を相談する' : '実家カルテを無料で依頼する';
    var btn = document.getElementById('applyBtn'); if (!btn.disabled) btn.textContent = buttonText();
    document.getElementById('moriIntakeNext').textContent = sale
      ? '売却相談として担当者へ伝えます。初回連絡で物件の状況・ご希望の時期を伺い、現地確認の方法や日程を相談します。申込みだけで媒介契約にはなりません。'
      : '価格の目安・確認点・次の対応を整理します。家族で検討してから、売却相談に進むか選べます。';
  }
  function decorate(anchor) {
    if (!context || !anchor) return;
    try {
      var u = new URL(anchor.href, location.href);
      if (u.origin !== location.origin || !['/karte/','/karte/sample/'].includes(u.pathname)) return;
      u.searchParams.set('area','森町'); u.searchParams.set('intent',context.intent);
      u.searchParams.set('utm_source','morimachi_lifehack'); u.searchParams.set('utm_medium','referral');
      u.searchParams.set('utm_campaign',CAMPAIGN); u.searchParams.set('utm_content',context.entry);
      anchor.href = u.toString();
    } catch (_) {}
  }
  function init() {
    if (isThanks) {
      var receipt = read(RECEIPT), panel = document.getElementById('moriReceipt');
      if (panel && valid(receipt) && /^MORI-[A-F0-9]{12}$/.test(receipt.id || '') && Date.now() - receipt.at >= 0 && Date.now() - receipt.at < 24 * 60 * 60 * 1000) {
        panel.hidden = false;
        document.getElementById('moriReceiptId').textContent = receipt.id;
        document.getElementById('moriReceiptNext').textContent = receipt.intent === 'sale'
          ? '売却相談の希望を受け付けました。ご希望の連絡方法で、物件の状況・希望時期・現地確認の進め方を確認します。追加の申込みは不要です。'
          : 'まず状況を整理したいという希望を受け付けました。必要資料と送付先を確認し、カルテをお送りします。家族で検討後、次の連絡時期も相談できます。';
      }
      return; // A thank-you-page visit is never a new conversion.
    }
    if (!context) return;
    var choice = document.getElementById('moriIntent');
    if (choice) {
      choice.value = context.intent;
      choice.addEventListener('change',function () { context.intent = choice.value; save(KEY, context); update(); });
      var city = document.getElementById('city'); if (city) city.addEventListener('change',update);
      var form = document.getElementById('unifiedApply');
      form.addEventListener('focusin',function (event) { if (active() && event.target.matches('input:not([type="hidden"]),textarea,select')) track('form_start'); });
      update();
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (items) { if (items.some(function (x) { return x.isIntersecting; }) && active()) { track('form_view'); io.disconnect(); } });
        io.observe(document.getElementById('applyHeading'));
      }
    }
    document.querySelectorAll('a[href]').forEach(decorate);
    document.addEventListener('click',function (event) { if (active()) decorate(event.target.closest('a[href]')); },true);
  }
  window.moriIntake = {
    payload: function () { return active() ? { campaign: CAMPAIGN, entry: context.entry, intent: context.intent } : undefined; },
    buttonText: buttonText,
    failure: function () { if (active()) track('submit_error'); },
    accepted: function (result) {
      if (!active() || !result || !result.receipt || !/^MORI-[A-F0-9]{12}$/.test(result.receipt.id || '')) return;
      save(RECEIPT, { campaign:CAMPAIGN, entry:context.entry, intent:context.intent, id:result.receipt.id, at:Date.now() });
      track('form_start'); track('accepted'); remove(KEY);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
