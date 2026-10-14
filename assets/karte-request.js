/* Shared contact validation and bounded transport. Never stores contact values. */
(function () {
  'use strict';
  function normalizePhone(value) {
    return String(value || '').normalize('NFKC').replace(/[\s()（）\-‐‑‒–—―ー−]/g, '');
  }
  function emailValid(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
  function phoneValid(value) {
    var phone = normalizePhone(value);
    return /^0\d{9,10}$/.test(phone) || /^\+[1-9]\d{6,14}$/.test(phone);
  }
  async function send(url, payload) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer;
    var deadline = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error('send_timeout'));
        if (controller) controller.abort();
      }, 30000);
    });
    try {
      return await Promise.race([deadline, (async function () {
        var response = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller ? controller.signal : undefined});
        var data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'send_failed');
        return data;
      })()]);
    } finally { clearTimeout(timer); }
  }
  window.karteRequest = {
    emailValid: emailValid, phoneValid: phoneValid, normalizePhone: normalizePhone, send: send,
    timeoutMessage: '通信が長引き、受付結果を確認できませんでした。入力内容は残っています。重複申込みを避けるため、LINEまたは電話で受付状況をご確認ください。'
  };
})();
