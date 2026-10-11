/* Only fixed editorial keys travel in URLs or analytics. Contact values stay in the existing POST. */
(function () {
  'use strict';
  var concerns = { belongings: '荷物が残っている', demolition: '解体するか迷っている', distant: '遠方で管理が難しい', care: '親の施設入居後の家', garden: '庭木・残置物が気になる', undecided: 'まだ決まっていない' };
  var entries = ['special', 'hikaku', 'memo', 'leftover-items', 'demolition-or-old-house', 'faraway-management', 'after-care-facility', 'garden-leak-neighbor', 'home', 'jikka', 'kaigo-jikka', 'shindan'];
  var params = new URLSearchParams(window.location.search);
  var concern = Object.prototype.hasOwnProperty.call(concerns, params.get('concern')) ? params.get('concern') : '';
  var entry = entries.indexOf(params.get('entry')) !== -1 ? params.get('entry') : '';
  var isSpecial = document.body.getAttribute('data-jikka-special') === 'true';
  if (isSpecial && !entry) entry = window.location.pathname.indexOf('/hikaku/') !== -1 ? 'hikaku' : 'special';
  function metadata() { return { special: 'katazuke-kaitai', concern: concern || 'undecided', entry: entry || 'special' }; }
  function track(name, selected) {
    var data = metadata();
    if (Object.prototype.hasOwnProperty.call(concerns, selected)) data.concern = selected;
    if (window.fgaMeasurement) window.fgaMeasurement.track(name, data);
  }
  var select = document.getElementById('specialConcern');
  var context = document.getElementById('specialContext');
  if (select) {
    select.value = concern;
    select.addEventListener('change', function () { concern = select.value; });
    if (context && (entry || concern)) {
      context.hidden = false;
      if (select.closest('details')) select.closest('details').open = true;
      context.textContent = '片付け・解体前の比較相談として受け付けます。下の「相談したいこと」は変更できます。';
    }
  }
  window.jikkaSpecial = {
    submission: function () {
      return { topic: concerns[concern] || '', entry: entry, special: entry || concern ? 'katazuke-kaitai' : '' };
    },
    track: function (name) { if (entry || concern) track(name); }
  };
  // Carry article attribution through the comparison page. Explicit concern links win.
  Array.prototype.forEach.call(document.querySelectorAll('a[data-special-link]'), function (link) {
    var url = new URL(link.getAttribute('href'), window.location.href);
    if (url.origin !== window.location.origin) return;
    if (entry) url.searchParams.set('entry', entry);
    if (concern && !url.searchParams.has('concern')) url.searchParams.set('concern', concern);
    link.setAttribute('href', url.pathname + url.search + url.hash);
  });
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-special-link]');
    if (!link) return;
    var destination = new URL(link.href, window.location.href);
    if (destination.pathname === '/karte/') track('jikka_special_consult_click', destination.searchParams.get('concern'));
    else if (destination.pathname.indexOf('/hikaku/') !== -1) track('jikka_special_sample_click');
  });
  if (isSpecial) track(window.location.pathname.indexOf('/hikaku/') !== -1 ? 'jikka_special_sample_view' : 'jikka_special_view');
})();
