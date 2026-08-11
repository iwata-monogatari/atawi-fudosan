// 実家カルテ申込フォームの受付エンドポイント (Cloudflare Pages Function)
//
// 送信元ページ: / (トップ), /karte/, /from-temple/, /from-shrine/, /kaigo-jikka/
// 通知メールは Resend (https://resend.com) 経由で会社アドレスへ送る。
// Resend が未設定・失敗の場合は旧Worker (atawi-fudosan-karte-api) へ転送し、
// それも失敗したときだけ ok:false を返す（フォーム側がLINE・電話への誘導を表示する）。
//
// Pages プロジェクトの環境変数:
//   RESEND_API_KEY … Resend のAPIキー (Secret)。未設定の間は旧Workerへの転送のみ。
//   MAIL_TO        … 通知先 (省略時 fudosan@fujigaoka-service.co.jp)
//   MAIL_FROM      … 差出人 (省略時 karte@atawi.link。Resendでatawi.linkのドメイン認証が必要)
//   FALLBACK_API   … 旧WorkerのURL (省略時は従来のworkers.devのURL)

const DEFAULT_MAIL_TO = 'fudosan@fujigaoka-service.co.jp';
const DEFAULT_MAIL_FROM = 'ふじがおか実家カルテ申込 <karte@atawi.link>';
const DEFAULT_FALLBACK_API = 'https://atawi-fudosan-karte-api.hiroyukio0122.workers.dev';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
  });
}

const FIELD_LABELS = [
  ['addr', '物件の住所'],
  ['name', 'お名前'],
  ['mail', 'メールアドレス'],
  ['tel', '電話番号'],
  ['rel', '物件とのご関係'],
  ['topic', '相談内容'],
  ['follow', '初回連絡の希望'],
  ['stage', '検討状況'],
  ['body', 'メモ・自由記入'],
  ['area', 'エリア'],
  ['source', '申込元'],
  ['pageUrl', '申込ページ'],
  ['referrer', '参照元'],
];

function buildMailText(data, meta) {
  const lines = ['ふじがおか実家カルテの申込フォームから新しい申込がありました。', ''];
  for (const [key, label] of FIELD_LABELS) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      lines.push(label + ': ' + String(value).trim());
    }
  }
  lines.push('');
  lines.push('受付日時: ' + meta.receivedAt + '（日本時間）');
  lines.push('送信元IP: ' + meta.ip);
  lines.push('');
  lines.push('このメールに返信すると申込者に直接届きます（Reply-To設定済み）。');
  return lines.join('\n');
}

async function sendViaResend(env, data, meta) {
  const payload = {
    from: env.MAIL_FROM || DEFAULT_MAIL_FROM,
    to: [env.MAIL_TO || DEFAULT_MAIL_TO],
    subject: '【実家カルテ申込】' + String(data.addr || '').slice(0, 60),
    text: buildMailText(data, meta),
  };
  if (data.mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.mail).trim())) {
    payload.reply_to = String(data.mail).trim();
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('resend_failed status=' + res.status + ' body=' + detail.slice(0, 300));
  }
}

async function forwardToLegacyWorker(env, rawBody) {
  const res = await fetch(env.FALLBACK_API || DEFAULT_FALLBACK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data && data.ok) {
    return true;
  }
  throw new Error('legacy_worker_failed status=' + res.status);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let rawBody;
  let data;
  try {
    rawBody = await request.text();
    data = JSON.parse(rawBody);
  } catch (e) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // ハニーポット: 人間には見えない company 欄が埋まっていたらbotとみなし、
  // 成功を装って何もしない
  if (data.company && String(data.company).trim() !== '') {
    return json({ ok: true });
  }

  if (!data.addr || !data.mail) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }

  const meta = {
    receivedAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
  };

  // 申込内容は必ずログに残す (Cloudflare Pages の Functions ログ・Logpush で確認可能)。
  // メールが落ちても申込内容そのものが消えないようにするための保険。
  console.log('karte-apply', JSON.stringify({ data, meta }));

  if (env.RESEND_API_KEY) {
    try {
      await sendViaResend(env, data, meta);
      return json({ ok: true });
    } catch (e) {
      console.log('karte-apply resend error: ' + e.message);
    }
  } else {
    console.log('karte-apply RESEND_API_KEY not set; using fallback');
  }

  try {
    await forwardToLegacyWorker(env, rawBody);
    return json({ ok: true });
  } catch (e) {
    console.log('karte-apply fallback error: ' + e.message);
  }

  return json({ ok: false, error: 'send_failed' }, 502);
}
