(function () {
  'use strict';
  var form = document.getElementById('lpForm');
  if (!form) return;
  var theme = form.dataset.theme;
  var situation = form.dataset.situation;
  var measurement = window.fgaMeasurement;
  var seen = {};
  function track(name, extra, once) {
    if (once && seen[name]) return;
    if (once) seen[name] = true;
    if (measurement) measurement.track(name, Object.assign({ lp_theme: theme, page_version: 'concern-lp-v1' }, extra || {}));
  }
  function field(name) { return form.elements.namedItem(name); }
  if (window.karteContext) window.karteContext.save(situation);
  track('lp_landing', {}, true);
  // Reuse the site's existing tracker. Do not load ad or analytics scripts in QA contexts.
  if (measurement && !measurement.excluded) {
    var tracker = document.createElement('script');
    tracker.src = 'https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js';
    tracker.dataset.site = 'atawi-fudosan';
    tracker.onload = function () { measurement.flush(); };
    document.body.appendChild(tracker);
  }
  var error = document.getElementById('lpError');
  var submit = document.getElementById('lpSubmit');
  var submitLabel = submit.textContent;
  function showError(message) { error.hidden = false; error.textContent = message; error.focus(); }
  function updateContact() {
    var method = field('contactMethod').value;
    ['email', 'phone'].forEach(function (kind) {
      var input = field(kind === 'email' ? 'mail' : 'tel');
      input.required = method === kind;
      input.disabled = method !== kind;
      document.getElementById('lp-' + kind).hidden = method !== kind;
    });
  }
  form.querySelectorAll('[name="contactMethod"]').forEach(function (input) { input.addEventListener('change', updateContact); });
  updateContact();
  form.addEventListener('input', function (event) {
    if (event.target.name === 'company') return;
    track('lp_form_start', {}, true);
    if ((event.target.name === 'mail' || event.target.name === 'tel') && event.target.value.trim()) {
      track('lp_contact_input', { contact_type: event.target.name === 'mail' ? 'email' : 'phone' }, true);
    }
  });
  field('city').addEventListener('change', function () { track('lp_city_select', { city: field('city').value }); });
  form.addEventListener('invalid', function () { track('lp_validation_error', { reason: 'missing' }); }, true);
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-lp-event]');
    if (link) track(link.dataset.lpEvent, { location: link.dataset.location || 'lp_body' });
  });
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        track('lp_form_view', {}, true); observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(document.getElementById('lp-form-title'));
    var sticky = document.getElementById('lpSticky');
    var stickyObserver = new IntersectionObserver(function (entries) {
      sticky.hidden = entries.some(function (entry) { return entry.isIntersecting; });
    }, { threshold: 0 });
    stickyObserver.observe(form);
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submit.disabled) return;
    error.hidden = true;
    var city = field('city').value;
    var town = field('town').value.trim();
    var method = field('contactMethod').value;
    var contact = field(method === 'email' ? 'mail' : 'tel').value.trim();
    if (!town || !contact) {
      showError('町名と、選択した連絡先をご確認ください。');
      track('lp_validation_error', { reason: 'missing' }); return;
    }
    track('lp_form_start', {}, true);
    submit.disabled = true; submit.textContent = '送信しています…';
    // Only the application endpoint receives address/contact/message values.
    // Analytics receives allowlisted topic IDs and stages only.
    var payload = {
      addr: [city, town, field('addressDetail').value.trim()].filter(Boolean).join(' '),
      name: field('name').value.trim(),
      mail: method === 'email' ? contact : '', tel: method === 'phone' ? contact : '',
      company: field('company').value.trim(), property: '実家・親の家',
      situation: form.dataset.label,
      topic: form.dataset.comparison === 'true' ? '売る・貸す・残すの比較相談（必要に応じて実家カルテ）' : '実家カルテの価格目安・課題整理',
      stage: field('intent').value,
      appraisal: '机上の価格目安を標準提供',
      follow: method === 'email' ? 'メールで初回回答希望' : '電話で初回連絡希望',
      body: field('body').value.trim(), source: 'lp/' + theme,
      pageUrl: window.location.origin + window.location.pathname,
      referrer: document.referrer.split('?')[0].split('#')[0]
    };
    try {
      var response = await fetch('/api/karte-apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      var data = await response.json();
      if (!response.ok || !data.ok) {
        if (data.error === 'out_of_area') throw new Error('out_of_area');
        throw new Error('send_failed');
      }
      track('lp_application_success', {}, true);
      if (measurement) { measurement.markSubmit(); measurement.flush(); }
      else if (window.fgaMarkKarteSubmit) window.fgaMarkKarteSubmit();
      window.location.assign('/karte/thanks/?lp=' + encodeURIComponent(theme));
    } catch (err) {
      showError(err.message === 'out_of_area'
        ? '対応地域をご確認ください。対象は磐田市・袋井市・森町・掛川市・菊川市・御前崎市・湖西市・浜松市の物件です。'
        : '送信できませんでした。入力内容はこの画面に残っています。再度お試しいただくか、下のLINE・電話でご連絡ください。');
      track('lp_submit_error', { reason: 'server' });
      submit.disabled = false; submit.textContent = submitLabel;
    }
  });
})();
