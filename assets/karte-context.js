(function (window) {
  'use strict';

  var STORAGE_KEY = 'fga_karte_situation_v1';
  var ALIASES = { facility: 'care' };
  var ALLOWED = ['care', 'inheritance', 'vacant', 'undecided'];
  var SAMPLE_BY_SITUATION = { care: 'a', inheritance: 'b', vacant: 'c', undecided: 'a' };

  function normalize(value) {
    var key = String(value || '').toLowerCase();
    key = ALIASES[key] || key;
    return ALLOWED.indexOf(key) !== -1 ? key : '';
  }

  function read() {
    try { return normalize(window.sessionStorage.getItem(STORAGE_KEY)); }
    catch (error) { return ''; }
  }

  function save(value) {
    var key = normalize(value);
    if (!key) { return ''; }
    try { window.sessionStorage.setItem(STORAGE_KEY, key); }
    catch (error) { /* The page remains usable when storage is unavailable. */ }
    return key;
  }

  function clear() {
    try { window.sessionStorage.removeItem(STORAGE_KEY); }
    catch (error) { /* The page remains usable when storage is unavailable. */ }
  }

  window.karteContext = {
    normalize: normalize,
    read: read,
    save: save,
    clear: clear,
    sampleFor: function (value) { return SAMPLE_BY_SITUATION[normalize(value)] || ''; }
  };
})(window);
