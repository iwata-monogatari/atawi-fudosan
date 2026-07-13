/* ふじがおか 実家じまい・空き家相談室 ― main.js */
(function () {
  "use strict";

  /* スマホ用ナビ開閉 */
  var header = document.getElementById("header");
  var toggle = document.getElementById("navToggle");
  if (toggle && header) {
    toggle.addEventListener("click", function () {
      header.classList.toggle("open");
    });
    // ナビ内リンクを押したら閉じる
    var navLinks = header.querySelectorAll(".nav a");
    navLinks.forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("open");
      });
    });
  }

  /* FAQ アコーディオン */
  var faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(function (item) {
    var q = item.querySelector(".faq-q");
    if (!q) return;
    q.addEventListener("click", function () {
      item.classList.toggle("open");
    });
  });

  /* スムーススクロール（固定ヘッダー分のオフセット補正） */
  var headerH = 64;
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerH + 1;
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  });
})();
