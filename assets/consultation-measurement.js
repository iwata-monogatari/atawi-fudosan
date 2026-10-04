/* Shared by /, /karte/ and the public sample page. No contact values, user IDs, or new recipients.
 * A queued event is handed to the existing tracker once; handoff is not receipt.
 * No transport retries: without server idempotency a retry may double-count.
 */
(function () {
  'use strict';
  if (window.fgaMeasurement) return;
  var aliases = { line_click: 'line_consult', tel_click: 'phone_consult',
    email_click: 'email_consult', karte_apply_click: 'karte_consult',
    form_complete: 'form_consult', thanks_line_fast_click: 'line_consult',
    thanks_mail_click: 'email_consult', thanks_sale_mail_click: 'email_consult', thanks_sale_tel_click: 'phone_consult' };
  var stages = ['ad_landing', 'cta_click', 'form_view', 'form_start', 'city_select', 'contact_input', 'complete', 'submit_error'];
  var prefix = 'fga_karte-application-funnel-v2_';
  var queue = [], seen = {}, timer = null, polls = 0;
  // Page memory only: no new persistent identifier or attribution storage.
  var excluded = excludedContext();
  var allowed = {
    page_version: ['intent-first-v1', 'concern-lp-v1'], funnel_version: ['application-funnel-v2', 'karte-application-funnel-v2'],
    lp_theme: ['parent-care', 'inheritance', 'distant-home', 'belongings', 'difficult-property', 'sell-rent-keep'],
    route: ['address', 'tax_notice_photo', 'all'], stage: ['view', 'route_click', 'form_start', 'complete'],
    contact_type: ['email', 'phone'], source: ['google_ads'], page: ['index'],
    city: ['磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市'],
    from: ['form', 'hero'], property: ['jikka', 'jitaku'], appraisal: ['standard'],
    reason: ['server', 'files', 'contact', 'email', 'privacy', 'missing'],
    location: ['index', 'form', 'apply', 'hero', 'hero_intent', 'hero_closed', 'hero_direct', 'hero_value_card', 'hero_value_image', 'apply_shared', 'nav', 'nav_mobile', 'header', 'post_hero_text', 'karte_proof_image', 'karte_proof', 'visual_overview_card', 'home_scenes', 'situation_jitaku', 'place', 'check_list_photo', 'dcv', 'mcv', 'delegated', 'hero_apply_click', 'mcv_apply_click', 'lp_header', 'lp_hero', 'lp_sample', 'lp_sticky', 'lp_form', 'lp_body'],
    topic: ['owner', 'property', 'next_steps'], card: ['own-home-future', 'before-selling-own-home', 'senior-relocation'],
    tab: ['before', 'after', 'manage', 'jitaku'], sample_id: ['a', 'b', 'c'], situation: ['not_selected', 'care', 'facility', 'inheritance', 'vacant', 'undecided']
  };
  function sanitize(extra) {
    var result = {};
    Object.keys(extra || {}).forEach(function (key) {
      if (key === 'count' && Number.isInteger(extra[key]) && extra[key] >= 0 && extra[key] <= 3) result[key] = extra[key];
      else if (allowed[key] && allowed[key].indexOf(extra[key]) !== -1) result[key] = extra[key];
    });
    return result;
  }
  function excludedContext() {
    var p = new URLSearchParams(window.location.search);
    var blocked = false;
    p.forEach(function (_, key) { if (key === 'check' || key.indexOf('codex_') === 0) blocked = true; });
    ['fga_ignore', 'fujigaoka_analytics_ignore', 'fga_internal', 'fujigaoka_analytics_internal', 'atawi_internal', 'preview', 'admin_check', 'internal_check'].forEach(function (key) {
      if (p.has(key) && ['', '1', 'true', 'yes'].indexOf(p.get(key)) !== -1) blocked = true;
    });
    ['fujigaokaAnalyticsIgnore', 'fujigaokaAnalyticsInternal'].forEach(function (key) {
      try { if (window.localStorage.getItem(key) === '1') blocked = true; } catch (_) {}
      if ((document.cookie || '').split(';').some(function (part) { return part.trim() === key + '=1'; })) blocked = true;
    });
    var host = window.location.hostname.toLowerCase();
    return blocked || !!navigator.webdriver || /HeadlessChrome|Playwright|Puppeteer|Codex|ChatGPT|OpenAI|OAI-SearchBot/i.test(navigator.userAgent || '') ||
      host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || /\.(local|pages\.dev|workers\.dev)$/.test(host);
  }
  function sessionSeen(key) {
    try { return window.sessionStorage.getItem(key) === '1'; } catch (_) { return false; }
  }
  function flush() {
    if (excluded || typeof window.fgaTrack !== 'function') return;
    // Remove before handing over, including reentrant or throwing callbacks.
    while (queue.length) {
      var item = queue.shift();
      if (item.key && sessionSeen(item.key)) continue;
      if (item.key) { try { window.sessionStorage.setItem(item.key, '1'); } catch (_) {} }
      try { window.fgaTrack(item.name, item.payload); } catch (_) { /* ambiguous handoff: never retry */ }
    }
    if (timer !== null) { window.clearInterval(timer); timer = null; }
  }
  function enqueue(name, payload, key) {
    if (excluded) return;
    // Bound memory when an extension or network failure blocks the tracker.
    if (queue.length >= 100) return;
    queue.push({ name: aliases[name] || name, payload: sanitize(payload), key: key });
    flush();
    if (queue.length && timer === null && polls < 300) timer = window.setInterval(function () {
      polls += 1;
      flush();
      if (polls >= 300 && timer !== null) { window.clearInterval(timer); timer = null; }
    }, 100);
    // The tracker script's onload, window load/pageshow and later actions still
    // flush after this bounded readiness poll, including very slow downloads.
  }
  function track(name, extra) {
    if (excluded || typeof name !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(name)) return;
    var payload = sanitize(extra);
    // /karte/ keeps its completion owner on the gated thank-you page.
    // Emitting this alias here as well would count the same application twice.
    if (name !== 'form_submit_success') enqueue(name, payload);
    // Keep existing Google event names; canonical names are sent only to FGA.
    if (typeof window.gtag === 'function') window.gtag('event', name, payload);
  }
  function stage(name, extra) {
    if (excluded || stages.indexOf(name) === -1) return;
    var key = prefix + name;
    if (seen[key] || sessionSeen(key)) return;
    seen[key] = true; // pending in page memory, not persisted as delivered
    var payload = sanitize(extra);
    enqueue('karte_application_' + name, payload, key);
    if (typeof window.gtag === 'function') window.gtag('event', 'karte_application_' + name, payload);
  }
  function markSubmit() {
    if (excluded) return;
    // Reuse the existing ads-conversion.js receipt marker (no new identifier).
    try { window.sessionStorage.setItem('fgaKarteSubmit', String(Date.now())); } catch (_) {}
  }
  window.fgaMeasurement = { track: track, stage: stage, flush: flush, markSubmit: markSubmit, excluded: excluded };
  window.addEventListener('load', flush);
  window.addEventListener('pageshow', flush);
  window.addEventListener('pagehide', function () {
    flush();
    if (timer !== null) { window.clearInterval(timer); timer = null; }
  });
})();
