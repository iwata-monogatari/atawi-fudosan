// 実家カルテ申込フォームの受付エンドポイント (Cloudflare Pages Function)
//
// 送信元ページ: / (トップ), /karte/, /from-temple/, /from-shrine/, /kaigo-jikka/
// 通知メールは Resend (https://resend.com) 経由で会社アドレスへ送る。
// 送信に失敗したときは ok:false を返す（フォーム側がLINE・電話への誘導を表示する）。
//
// Pages プロジェクトの環境変数:
//   RESEND_API_KEY … Resend のAPIキー (Secret)
//   MAIL_TO        … 通知先 (省略時 fudosan@fujigaoka-service.co.jp)
//   MAIL_FROM      … 差出人 (省略時 karte@atawi.link。Resendでatawi.linkのドメイン認証が必要)

const DEFAULT_MAIL_TO = 'fudosan@fujigaoka-service.co.jp';
const DEFAULT_MAIL_FROM = 'ふじがおか実家カルテ申込 <karte@atawi.link>';
const MAX_MULTIPART_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PHOTO_FILES = 3;
const MAX_PHOTO_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_TOTAL_BYTES = 10 * 1024 * 1024;

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
  ['property', '調べたい家'],
  ['appraisal', '売却査定'],
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
  const lines = [meta.isPhoto
    ? 'トップページから固定資産税通知書の写真が届きました。'
    : 'ふじがおか実家カルテの申込フォームから新しい申込がありました。', ''];
  for (const [key, label] of FIELD_LABELS) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      lines.push(label + ': ' + String(value).trim());
    }
  }
  if (meta.attachmentNames && meta.attachmentNames.length) {
    lines.push('添付写真: ' + meta.attachmentNames.length + '枚');
    for (const name of meta.attachmentNames) lines.push('  - ' + name);
  }
  lines.push('');
  lines.push('受付日時: ' + meta.receivedAt + '（日本時間）');
  lines.push('送信元IP: ' + meta.ip);
  lines.push('');
  if (meta.telOnly) {
    lines.push('※ メールアドレスの入力がありません。お電話で折り返してください。');
  } else {
    lines.push('申込者メール: ' + String(data.mail).trim());
    lines.push('この通知メールに返信すると、上記の申込者メールへ直接届きます（Reply-To設定済み）。');
  }
  return lines.join('\n');
}

async function sendViaResend(env, data, meta, attachments) {
  const payload = {
    from: env.MAIL_FROM || DEFAULT_MAIL_FROM,
    // 書類写真はユーザー指定の受付先へ固定。従来フォームは環境変数で変更可能。
    to: [meta.isPhoto ? DEFAULT_MAIL_TO : (env.MAIL_TO || DEFAULT_MAIL_TO)],
    // 折り返しが要るか、査定の希望があるかを件名だけで判別できるようにする。
    subject: (meta.isPhoto ? '【固定資産税通知書・写真相談' : '【実家カルテ申込')
      + (meta.telOnly ? '・要折返し' : '')
      + (meta.wantsAppraisal ? '・査定希望' : '')
      + '】' + String(data.addr || (meta.isPhoto ? '住所は添付画像を確認' : '')).slice(0, 60),
    text: buildMailText(data, meta),
  };
  if (attachments && attachments.length) payload.attachments = attachments;
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function detectImageExtension(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e
      && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return brand === 'mif1' || brand === 'msf1' ? 'heif' : 'heic';
  }
  return '';
}

async function preparePhotoAttachments(files) {
  if (!files.length) throw new Error('missing_photos');
  if (files.length > MAX_PHOTO_FILES) throw new Error('too_many_photos');
  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('invalid_photo');
    if (!file.size || file.size > MAX_PHOTO_FILE_BYTES) throw new Error('photo_too_large');
    totalBytes += file.size;
  }
  if (totalBytes > MAX_PHOTO_TOTAL_BYTES) throw new Error('photos_too_large');

  const attachments = [];
  for (let i = 0; i < files.length; i++) {
    const buffer = await files[i].arrayBuffer();
    const extension = detectImageExtension(new Uint8Array(buffer));
    if (!extension) throw new Error('invalid_photo_type');
    attachments.push({
      filename: 'fixed-asset-tax-notice-' + (i + 1) + '.' + extension,
      content: arrayBufferToBase64(buffer),
    });
  }
  return attachments;
}

async function parseSubmission(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength && contentLength > MAX_MULTIPART_REQUEST_BYTES) throw new Error('request_too_large');
    const form = await request.formData();
    const data = {};
    for (const key of ['addr', 'mail', 'tel', 'company', 'source', 'pageUrl', 'referrer', 'body']) {
      const value = form.get(key);
      data[key] = typeof value === 'string' ? value : '';
    }
    return { data, files: form.getAll('files').filter((value) => typeof value !== 'string'), isMultipart: true };
  }
  try {
    return { data: JSON.parse(await request.text()), files: [], isMultipart: false };
  } catch (e) {
    throw new Error('invalid_json');
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let data;
  let files;
  let isMultipart;
  try {
    ({ data, files, isMultipart } = await parseSubmission(request));
  } catch (e) {
    const status = e.message === 'request_too_large' ? 413 : 400;
    return json({ ok: false, error: e.message || 'invalid_request' }, status);
  }

  // ハニーポット: 人間には見えない company 欄が埋まっていたらbotとみなし、
  // 成功を装って何もしない
  if (data.company && String(data.company).trim() !== '') {
    return json({ ok: true });
  }

  // 連絡先はメールか電話番号のどちらかがあればよい。
  // 相談者は高齢の所有者本人が多く、メール必須が入力開始そのものを止めていた
  // (2026-08-27〜08-30: フォーム表示63件に対し入力開始1件)。
  // カルテPDFの送付先メールは、物件を特定するSTEP2までに伺えば間に合う。
  const hasMail = data.mail && String(data.mail).trim() !== '';
  const hasTel = data.tel && String(data.tel).trim() !== '';
  const isPhoto = isMultipart && data.source === 'top/tax-notice-photo';
  if ((isPhoto && !hasMail) || (!isPhoto && (!data.addr || (!hasMail && !hasTel)))) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }
  if (hasMail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.mail).trim())) {
    return json({ ok: false, error: 'invalid_mail' }, 400);
  }

  let attachments = [];
  if (isPhoto) {
    try {
      attachments = await preparePhotoAttachments(files);
    } catch (e) {
      const sizeErrors = ['photo_too_large', 'photos_too_large', 'request_too_large'];
      return json({ ok: false, error: e.message || 'invalid_photo' }, sizeErrors.includes(e.message) ? 413 : 400);
    }
  }

  const meta = {
    receivedAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    telOnly: !hasMail && hasTel,
    wantsAppraisal: String(data.appraisal || '').indexOf('希望する') !== -1,
    isPhoto,
    attachmentNames: attachments.map((item) => item.filename),
  };

  // 申込内容は必ずログに残す (Cloudflare Pages の Functions ログ・Logpush で確認可能)。
  // メールが落ちても申込内容そのものが消えないようにするための保険。
  console.log('karte-apply', JSON.stringify({ data, meta }));

  if (env.RESEND_API_KEY) {
    try {
      await sendViaResend(env, data, meta, attachments);
      return json({ ok: true });
    } catch (e) {
      console.log('karte-apply resend error: ' + e.message);
    }
  } else {
    console.log('karte-apply RESEND_API_KEY not set');
  }

  return json({ ok: false, error: 'send_failed' }, 502);
}
