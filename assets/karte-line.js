(function () {
  'use strict';
  var button = document.getElementById('copyLineMessage');
  var message = document.getElementById('lineMessage');
  var status = document.getElementById('copyLineStatus');
  if (!button || !message || !status) return;
  button.hidden = false;
  button.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'コピーしました。LINEのトークに貼り付け、市町村・町名を記入して送信してください。';
    } catch (error) {
      message.focus();
      message.select();
      status.textContent = '自動コピーができませんでした。文面を選択しているので、手動でコピーしてください。';
    }
  });
})();
