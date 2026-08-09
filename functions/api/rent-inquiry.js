// 戸建て賃貸の問い合わせフォーム受付エンドポイント (Cloudflare Pages Function)
//
// 送信元ページ: /rent/
// 通知メールは karte-apply.js と同じ Resend アカウントで会社アドレスへ送る。
// 件名だけ分けてあるので、実家カルテの申込と受信箱で混ざらない。
//
// Pages プロジェクトの環境変数（karte-apply と共用）:
//   RESEND_API_KEY … Resend のAPIキー (Secret)
//   MAIL_TO        … 通知先 (省略時 fudosan@fujigaoka-service.co.jp)
//   RENT_MAIL_FROM … 差出人 (省略時 rent@atawi.link。Resendでatawi.linkのドメイン認証済み)

const DEFAULT_MAIL_TO = 'fudosan@fujigaoka-service.co.jp';
const DEFAULT_MAIL_FROM = 'ATAWI FUDOSAN 戸建て賃貸 <rent@atawi.link>';

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
  ['kind', 'ご用件'],
  ['name', 'お名前・法人名'],
  ['mail', 'メールアドレス'],
  ['tel', '電話番号'],
  ['addr', '物件の所在地／ご希望エリア'],
  ['body', 'ご希望・ご質問'],
  ['source', '申込元'],
  ['pageUrl', '問い合わせページ'],
  ['referrer', '参照元'],
];

function buildMailText(data, meta) {
  const lines = ['戸建て賃貸のページ（/rent/）から新しいお問い合わせがありました。', ''];
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
  lines.push('このメールに返信すると問い合わせ主に直接届きます（Reply-To設定済み）。');
  return lines.join('\n');
}

async function sendViaResend(env, data, meta) {
  const kind = String(data.kind || '').slice(0, 24);
  const addr = String(data.addr || '').slice(0, 40);
  const payload = {
    from: env.RENT_MAIL_FROM || DEFAULT_MAIL_FROM,
    to: [env.MAIL_TO || DEFAULT_MAIL_TO],
    subject: '【戸建て賃貸】' + (kind ? kind + '／' : '') + addr,
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let data;
  try {
    data = JSON.parse(await request.text());
  } catch (e) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // ハニーポット: 人には見えない company 欄が埋まっていたらbotとみなし、成功を装って捨てる
  if (data.company && String(data.company).trim() !== '') {
    return json({ ok: true });
  }

  if (!data.mail || !data.name || !data.addr) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }

  const meta = {
    receivedAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
  };

  // メールが落ちても問い合わせ内容が消えないように、必ずログへ残す。
  console.log('rent-inquiry', JSON.stringify({ data, meta }));

  if (!env.RESEND_API_KEY) {
    console.log('rent-inquiry RESEND_API_KEY not set');
    return json({ ok: false, error: 'mail_not_configured' }, 502);
  }

  try {
    await sendViaResend(env, data, meta);
    return json({ ok: true });
  } catch (e) {
    console.log('rent-inquiry resend error: ' + e.message);
    return json({ ok: false, error: 'send_failed' }, 502);
  }
}
