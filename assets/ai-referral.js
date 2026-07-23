(function () {
  'use strict';

  function sourceFromVisit() {
    var params = new URLSearchParams(window.location.search);
    var utmSource = (params.get('utm_source') || '').toLowerCase();
    var referrerHost = '';

    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
    } catch (error) {
      referrerHost = '';
    }

    if (
      utmSource === 'chatgpt.com' ||
      utmSource === 'chatgpt' ||
      referrerHost === 'chatgpt.com' ||
      referrerHost.endsWith('.chatgpt.com') ||
      referrerHost === 'chat.openai.com'
    ) {
      return 'chatgpt';
    }

    if (utmSource.includes('perplexity') || referrerHost === 'perplexity.ai' || referrerHost.endsWith('.perplexity.ai')) {
      return 'perplexity';
    }

    if (utmSource.includes('copilot') || referrerHost === 'copilot.microsoft.com') {
      return 'copilot';
    }

    if (utmSource.includes('gemini') || referrerHost === 'gemini.google.com') {
      return 'gemini';
    }

    return '';
  }

  var source = sourceFromVisit();
  if (!source) return;

  window.__fgaAiReferralSource = source;

  var storageKey = 'fga_ai_referral_' + source;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, '1');
  } catch (error) {
    // Storage can be unavailable in privacy modes. Tracking may continue once.
  }

  var attempts = 0;
  function send() {
    attempts += 1;
    if (typeof window.fgaTrack === 'function') {
      window.fgaTrack('ai_referral_' + source);
      return;
    }
    if (attempts < 10) window.setTimeout(send, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', send, { once: true });
  } else {
    send();
  }
})();
