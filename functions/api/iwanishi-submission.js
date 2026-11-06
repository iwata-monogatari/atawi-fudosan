// Dedicated mail endpoint for the public alumni submission form.
const formOrigin = 'https://iwanishi.atawi.link';
const headers = {
  'Access-Control-Allow-Origin': formOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
};
const reply = (status, body) => Response.json(body, { status, headers });
const field = (value, limit) => typeof value === 'string' && value.length <= limit;
const kinds = new Map([
  ['new', '掲載希望'], ['correction', '紹介文の訂正'],
  ['removal', '掲載の削除'], ['source', '出典URLの変更'],
]);

export async function onRequest({ request, env }) {
  if (request.headers.get('Origin') !== formOrigin) return reply(403, { error: 'origin' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'method' });
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return reply(415, { error: 'type' });
  if (!request.body) return reply(400, { error: 'fields' });
  const reader = request.body.getReader();
  let raw = '', bytes = 0;
  const decoder = new TextDecoder();
  let data;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); return reply(413, { error: 'size' }); }
      raw += decoder.decode(value, { stream: true });
    }
    data = JSON.parse(raw + decoder.decode());
  } catch { return reply(400, { error: 'fields' }); }
  if (!data || data.website || !field(data.name, 80) || !data.name.trim() ||
      !field(data.url, 2048) || !field(data.email, 254) || !field(data.note, 1000) ||
      !field(data.id, 36) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id) ||
      /[\r\n]/.test(data.name) || (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) return reply(400, { error: 'fields' });
  // Older forms sent no kind and always submitted a new profile.
  const kind = data.kind === undefined ? 'new' : data.kind;
  if (!kinds.has(kind) || (kind === 'correction' && !data.note.trim())) return reply(400, { error: 'fields' });
  let url;
  if (data.url || kind === 'new' || kind === 'source') {
    try { url = new URL(data.url); } catch { return reply(400, { error: 'url' }); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return reply(400, { error: 'url' });
  }
  if (!env.RESEND_API_KEY) return reply(503, { error: 'mail' });
  const reference = 'IW-' + data.id;
  // Limit rapid repeat submissions at the edge without storing the form contents.
  const ip = request.headers.get('CF-Connecting-IP');
  let throttle;
  if (ip) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    throttle = new Request(new URL('/_iwanishi-mail-cooldown/' + hash, request.url));
    const recent = await caches.default.match(throttle);
    if (recent && await recent.text() !== reference) return reply(429, { error: 'wait' });
  }
  const message = {
    from: 'ATAWI磐田西高校 <iwanishi@atawi.link>',
    to: ['fudosan@fujigaoka-service.co.jp'],
    subject: '【磐西・磐商・' + kinds.get(kind) + '】' + reference,
    text: [
      'ATAWI磐田西高校の受付フォームより', '受付番号：' + reference, '依頼種別：' + kinds.get(kind), '',
      '掲載名：' + data.name.trim(),
      ...(url ? [(kind === 'source' ? '変更後の出典URL：' : '公開資料のURL：') + url.href] : []),
      '依頼内容・補足：' + (data.note.trim() || '記入なし'), '返信先：' + (data.email || '記入なし'),
    ].join('\n'),
    ...(data.email && { reply_to: data.email }),
  };
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json', 'Idempotency-Key': reference,
      },
      body: JSON.stringify(message), signal: AbortSignal.timeout(12000),
    });
    if (result.ok && typeof (await result.json()).id === 'string') {
      if (throttle) {
        await caches.default.put(throttle, new Response(reference, {
          headers: { 'Cache-Control': 'max-age=60' },
        })).catch(() => {});
      }
      return reply(200, { reference });
    }
  } catch { /* A retry with the same reference will not send a duplicate. */ }
  return reply(502, { error: 'mail' });
}
