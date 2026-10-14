/* Optional fields retain their values. This helper never reads or transports contact values. */
(function () {
  'use strict';
  var form = document.querySelector('.consultation-form');
  if (!form) return;
  var bar = document.querySelector('.karte-apply-page .mcv');
  if (bar) {
    function updateBar() {
      var r = form.getBoundingClientRect();
      var visible = r.bottom < 0;
      bar.classList.toggle('is-visible', visible);
      bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
    window.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar, { passive: true });
    updateBar();
  }

  // /karte/ already owns these stages. The homepage joins the same session funnel.
  if (form.id !== 'addressApply' || !window.fgaMeasurement) return;
  function stage(name, extra) {
    window.fgaMeasurement.stage(name, Object.assign({funnel_version:'karte-application-funnel-v2',page_version:'operations-usability-v1'}, extra || {}));
  }
  var firstQuestion = document.getElementById('cityChoice');
  if (firstQuestion && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting && e.intersectionRatio >= 0.5; })) {
        stage('form_view'); observer.disconnect();
      }
    }, {threshold:0.5});
    observer.observe(firstQuestion);
  }
  var city = document.getElementById('city');
  if (city) city.addEventListener('change', function () { if (city.value) stage('city_select', {city:city.value}); });
  function captureContact() {
    var selected = form.querySelector('input[name="contactMethod"]:checked');
    var field = selected && document.getElementById(selected.value === 'phone' ? 'tel' : 'mail');
    if (field && !field.hidden && field.value.trim()) stage('contact_input', {contact_type:selected.value});
  }
  ['mail','tel'].forEach(function (id) {
    var field = document.getElementById(id);
    if (field) { field.addEventListener('input', captureContact); field.addEventListener('change', captureContact); }
  });
  window.addEventListener('pageshow', captureContact);
  captureContact();
  document.addEventListener('click', function (event) {
    if (event.target.closest('a[href="#apply"], [data-funnel-route="address"]')) stage('cta_click');
  });
})();
