/* 相続はじめ・空き家相談室 ─ インタラクション */
(function () {
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () { menu.classList.toggle('open'); });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') menu.classList.remove('open'); });
  }
})();
(function () {
  var items = document.querySelectorAll('.faq__item');
  items.forEach(function (item) {
    var q = item.querySelector('.faq__q');
    var a = item.querySelector('.faq__a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      item.classList.toggle('open');
      a.style.maxHeight = isOpen ? null : a.scrollHeight + 'px';
    });
  });
})();
(function () {
  if (!('IntersectionObserver' in window)) return;
  var targets = document.querySelectorAll('.step, .opt, .reason, .flow__item, .link-card, .worry');
  targets.forEach(function (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'none';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach(function (el) { io.observe(el); });
})();
var CONTACT_EMAIL = 'fudosan@fujigaoka-service.co.jp';
function handleSubmit(e) {
  e.preventDefault();
  var f = e.target;
  function val(name) { var el = f.elements[name]; return el ? (el.value || '') : ''; }
  function multi(name) {
    var nodes = f.querySelectorAll('input[name="' + name + '"]:checked');
    return Array.prototype.map.call(nodes, function (n) { return n.value; }).join('、');
  }
  var lines = [
    'お名前：' + val('name'),
    '電話番号：' + val('tel'),
    'メール：' + val('email'),
    '不動産の所在地：' + val('address'),
    '現在の状況：' + multi('status'),
    '建物の有無：' + val('building'),
    '荷物の有無：' + val('goods'),
    '相談したい内容：' + val('message'),
    '希望連絡方法：' + multi('contactway'),
    '希望連絡時間帯：' + val('time'),
    '添付予定資料：' + multi('docs')
  ];
  var body = encodeURIComponent(lines.join('\n'));
  var subject = encodeURIComponent('【相続はじめ・空き家相談室】お問い合わせ');
  window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
  return false;
}
