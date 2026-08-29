#!/usr/bin/env node
/*
 * 広告ファネルを「流入面 (検索 / Display系)」別に集計して、事前に決めた判定基準に
 * 当てはめるレポート。
 *
 * 背景 (2026-08-29):
 *   /karte/ の広告流入 160UV に対し form_start は1件、フォーム送信は0件。
 *   一方 tel_click は10件 (6.3%) 出ていた。フォーム送信だけを成果と見ると
 *   「ファネルが死んでいる」と読めてしまうが、実際には電話が選ばれている。
 *   そこで主要KPIを「電話 + LINE + フォーム」の合算CVに切り替え、さらに
 *   流入面ごとに分けて見る。低意図の面 (Display/YouTube) が混ざったままの
 *   全体CV率は、LP改修の良し悪しの判断材料にならないため。
 *
 * 使い方:
 *   node _tools/ads-funnel-report.mjs              # 事前登録した測定期間
 *   node _tools/ads-funnel-report.mjs --from 2026-08-24 --to 2026-08-28
 *
 * 前提:
 *   /api/export.csv は ignored_clients に登録済みのIP (社内確認用) から叩くと
 *   認証なしで通る。403 が返る場合は、対象PCで一度
 *   https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/api/ignore-me
 *   を開いてから実行する。
 */

const WORKER = 'https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev';
const SITE_ID = 'atawi-fudosan';

/* ---------------------------------------------------------------------------
 * 事前登録した判定基準 (2026-08-29 に決定)。
 *
 * これは「データを見てから基準を動かさない」ためにコードへ固定してある。
 * 変更するときは、変更した日付と理由をここに追記すること。
 * ------------------------------------------------------------------------ */
const CRITERIA = {
  decidedOn: '2026-08-29',
  // 8/28 に実施した P-MAX の絞り込みの効果を測る期間。
  windowFrom: '2026-08-29',
  windowTo: '2026-09-05',
  // これ未満のサンプルでは判定しない (偶然の差を掴まないため)。
  minAdVisitors: 300,
  // 片方の面の合算CV率が、もう片方の何倍以上なら予算を動かすか。
  ratio: 3.0,
  // 当初 (8/29) は「検索系が Display系の3倍以上なら P-MAX を縮小」という
  // 片方向の基準だけを置いていた。しかし 8/24-29 のベースラインは逆で、
  // Display系 6.3-6.5% に対し検索系は 107人で0件だった。片方向のままだと
  // 「現状維持」しか出せない基準になるため、同じ日に対称形へ直した。
  actionSearchWins:
    'P-MAX を縮小し、検索キャンペーンへ予算を移す。あわせて P-MAX の URL拡張をオフにする。',
  actionDisplayWins:
    '検索キャンペーンの予算を絞り、P-MAX を維持する。検索側は停止する前に、' +
    'キーワードと /karte/ の内容がずれていないか (実家売却の意図と噛み合っているか) を点検する。',
  actionTie:
    '予算配分は現状維持。判断材料を LP側 (電話・LINEファースト化) の効果測定に移す。'
};

/* 合算CV の定義 (レイヤー1)。訪問者単位で重複を除いて数える。
 * phone_consult / line_consult / form_consult は tel_click 等の別名イベントで、
 * 同じクリックから二重に飛ぶため、ここでは数えない。 */
const CV_EVENTS = {
  電話: ['tel_click'],
  LINE: ['line_click'],
  フォーム: ['form_complete']
};

/* 流入面の分類。gad_source は Google 広告が付ける面の識別子。 */
function classifyChannel(url) {
  const source = /[?&]gad_source=(\d+)/.exec(url)?.[1];
  const hasGclid = /[?&]gclid=/.test(url);
  if (source === '1') return '検索系';
  if (source === '5') return 'Display系';
  if (source) return `その他広告面(gad_source=${source})`;
  if (hasGclid) return '広告(面不明)';
  return null; // 非広告
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

function pct(n, d) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : '–';
}

async function main() {
  const from = arg('from', CRITERIA.windowFrom);
  const to = arg('to', CRITERIA.windowTo);
  const today = new Date().toISOString().slice(0, 10);
  const effectiveTo = to > today ? today : to;

  // export.csv は「今日から遡ってN日」なので、from を含むだけの日数を要求する。
  const days = Math.min(90, Math.max(1, daysBetween(from, today) + 1));
  const limit = 5000;
  const res = await fetch(`${WORKER}/api/export.csv?days=${days}&limit=${limit}`);
  if (!res.ok) {
    console.error(`export.csv の取得に失敗しました (HTTP ${res.status})。`);
    console.error('403 の場合は /api/ignore-me を一度開いてから再実行してください。');
    process.exit(1);
  }
  const all = parseCsv(await res.text());
  if (all.length >= limit) {
    console.warn(`⚠ 取得件数が上限 ${limit} に達しました。期間を短くしないと集計が欠けます。\n`);
  }

  const rows = all
    .filter((r) => r.site_id === SITE_ID && r.is_bot === '0' && r.is_internal === '0')
    .filter((r) => r.date_jst >= from && r.date_jst <= effectiveTo)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // 訪問者を、最初に踏んだ広告の面に紐づける (ファーストタッチ)。
  // form_complete は /karte/thanks/ で発火し URL に広告パラメータが残らないため、
  // イベント単位ではなく訪問者単位で面を決める必要がある。
  const channelOf = new Map();
  for (const r of rows) {
    if (channelOf.has(r.ip_hash_short)) continue;
    const channel = classifyChannel(r.url);
    if (channel) channelOf.set(r.ip_hash_short, channel);
  }

  const stats = new Map();
  const bucket = (ch) => {
    if (!stats.has(ch)) {
      stats.set(ch, { visitors: new Set(), karte: new Set(), cv: {}, any: new Set() });
      for (const k of Object.keys(CV_EVENTS)) stats.get(ch).cv[k] = new Set();
    }
    return stats.get(ch);
  };

  for (const r of rows) {
    const ch = channelOf.get(r.ip_hash_short);
    if (!ch) continue;
    const b = bucket(ch);
    b.visitors.add(r.ip_hash_short);
    if (r.event_type === 'pageview' && r.path.startsWith('/karte')) b.karte.add(r.ip_hash_short);
    for (const [label, names] of Object.entries(CV_EVENTS)) {
      if (names.includes(r.event_name)) {
        b.cv[label].add(r.ip_hash_short);
        b.any.add(r.ip_hash_short);
      }
    }
  }

  const order = ['検索系', 'Display系'];
  const channels = [...stats.keys()].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
  );

  console.log(`\n=== 広告ファネル 面別レポート  ${from} 〜 ${effectiveTo} ===`);
  if (effectiveTo < to) console.log(`（測定期間 ${to} まで。まだ途中です）`);
  console.log('\n主要KPI = 合算CV（電話クリック + LINE + フォーム送信）／訪問者単位・重複除去\n');

  const head = ['流入面', '広告訪問', '/karte到達', '電話', 'LINE', 'フォーム', '合算CV', 'CV率'];
  const table = channels.map((ch) => {
    const b = stats.get(ch);
    return [
      ch,
      String(b.visitors.size),
      String(b.karte.size),
      String(b.cv['電話'].size),
      String(b.cv['LINE'].size),
      String(b.cv['フォーム'].size),
      String(b.any.size),
      pct(b.any.size, b.visitors.size)
    ];
  });
  // 全角は2桁として数えないと列がずれる。
  const width = (s) =>
    [...String(s)].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
  const widths = head.map((h, i) => Math.max(width(h), ...table.map((r) => width(r[i]))));
  const line = (cells) =>
    cells.map((c, i) => String(c) + ' '.repeat(Math.max(0, widths[i] - width(c)))).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of table) console.log(line(r));

  const totalAd = channels.reduce((n, ch) => n + stats.get(ch).visitors.size, 0);
  const totalCv = channels.reduce((n, ch) => n + stats.get(ch).any.size, 0);
  console.log(`\n広告訪問 合計 ${totalAd}人 / 合算CV ${totalCv}人 (${pct(totalCv, totalAd)})`);

  // --- 営業時間内 / 時間外 --------------------------------------------------
  // 8/24-29 の実測で電話クリック10件が全て営業時間外 (朝4-5時・夜19-22時) に
  // 起きており、誰も出ない時間の電話クリックは着信につながらない。
  // 時間外CVを受け皿 (LINE・留守電の折り返し) で回収できているかを毎回見る。
  const OPEN_FROM = 9;
  const OPEN_TO = 17; // 9:00-17:00 JST。/karte/ の時間帯連動CTAと同じ定義。
  const jstHour = (ts) => new Date(new Date(ts).getTime() + 9 * 3600000).getUTCHours();
  const inOpenHours = (ts) => {
    const h = jstHour(ts);
    return h >= OPEN_FROM && h < OPEN_TO;
  };
  const bands = new Map([
    ['営業時間内(9-17時)', { visitors: new Set(), cv: {}, any: new Set() }],
    ['時間外', { visitors: new Set(), cv: {}, any: new Set() }]
  ]);
  for (const b of bands.values()) for (const k of Object.keys(CV_EVENTS)) b.cv[k] = new Set();
  for (const r of rows) {
    if (!channelOf.get(r.ip_hash_short)) continue;
    const b = bands.get(inOpenHours(r.timestamp) ? '営業時間内(9-17時)' : '時間外');
    if (r.event_type === 'pageview') b.visitors.add(r.ip_hash_short);
    for (const [label, names] of Object.entries(CV_EVENTS)) {
      if (names.includes(r.event_name)) {
        b.cv[label].add(r.ip_hash_short);
        b.any.add(r.ip_hash_short);
      }
    }
  }
  console.log('\n--- 営業時間内(9-17時JST) / 時間外 ---');
  console.log('※ 両方の帯で行動した訪問者は両方に数える。');
  const bandHead = ['帯', '広告訪問', '電話', 'LINE', 'フォーム', '合算CV', 'CV率'];
  const bandTable = [...bands].map(([name, b]) => [
    name,
    String(b.visitors.size),
    String(b.cv['電話'].size),
    String(b.cv['LINE'].size),
    String(b.cv['フォーム'].size),
    String(b.any.size),
    pct(b.any.size, b.visitors.size)
  ]);
  const bandWidths = bandHead.map((h, i) => Math.max(width(h), ...bandTable.map((r) => width(r[i]))));
  const bandLine = (cells) =>
    cells.map((c, i) => String(c) + ' '.repeat(Math.max(0, bandWidths[i] - width(c)))).join('  ');
  console.log(bandLine(bandHead));
  console.log(bandWidths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of bandTable) console.log(bandLine(r));
  const offTel = bands.get('時間外').cv['電話'].size;
  if (offTel > 0) {
    console.log(
      `\n⚠ 時間外の電話クリックが ${offTel}件。誰も出ないため、留守電の折り返しか LINE で\n` +
        '  回収できたかを「実際の相談」の登録内容と突き合わせて確認すること。'
    );
  }

  // --- 事前登録した判定 ---------------------------------------------------
  console.log(`\n--- 判定基準（${CRITERIA.decidedOn} に事前登録・データを見て動かさない）---`);
  console.log(`測定期間 ${CRITERIA.windowFrom} 〜 ${CRITERIA.windowTo} / 最低サンプル ${CRITERIA.minAdVisitors}人`);
  console.log(`条件: 片方の合算CV率が、もう片方の ${CRITERIA.ratio} 倍以上か`);

  const search = stats.get('検索系');
  const display = stats.get('Display系');
  const rate = (b) => (b && b.visitors.size ? b.any.size / b.visitors.size : null);
  const sr = rate(search);
  const dr = rate(display);
  const show = (b) => `${b.any.size}/${b.visitors.size}人 = ${pct(b.any.size, b.visitors.size)}`;

  if (totalAd < CRITERIA.minAdVisitors) {
    console.log(
      `\n判定: 保留。広告訪問 ${totalAd}人 で最低サンプル ${CRITERIA.minAdVisitors}人に届いていません。`
    );
  } else if (sr === null || dr === null) {
    console.log('\n判定: 保留。片方の面のデータがありません。');
  } else {
    console.log(`\n検索系 ${show(search)} ／ Display系 ${show(display)}`);
    // 0除算を避けつつ「片方だけ0件」も判定できるようにする。
    const searchWins = dr === 0 ? sr > 0 : sr / dr >= CRITERIA.ratio;
    const displayWins = sr === 0 ? dr > 0 : dr / sr >= CRITERIA.ratio;
    if (sr === 0 && dr === 0) {
      console.log('判定: 保留。どちらの面も合算CVが0件です。');
    } else if (searchWins) {
      console.log(`判定: 検索系が優位。\n→ ${CRITERIA.actionSearchWins}`);
    } else if (displayWins) {
      console.log(`判定: Display系が優位。\n→ ${CRITERIA.actionDisplayWins}`);
    } else {
      console.log(`判定: 差は ${CRITERIA.ratio} 倍に届かない。\n→ ${CRITERIA.actionTie}`);
    }
  }

  // --- キャンペーン別 (Google広告で実際に動かす単位) -----------------------
  const byCampaign = new Map();
  const campaignOf = new Map();
  for (const r of rows) {
    if (campaignOf.has(r.ip_hash_short)) continue;
    const id = /[?&]gad_campaignid=(\d+)/.exec(r.url)?.[1];
    if (id) campaignOf.set(r.ip_hash_short, id);
  }
  for (const r of rows) {
    const id = campaignOf.get(r.ip_hash_short);
    if (!id) continue;
    if (!byCampaign.has(id)) byCampaign.set(id, { uv: new Set(), cv: new Set() });
    const b = byCampaign.get(id);
    b.uv.add(r.ip_hash_short);
    if (Object.values(CV_EVENTS).flat().includes(r.event_name)) b.cv.add(r.ip_hash_short);
  }
  if (byCampaign.size) {
    console.log('\n--- キャンペーン別（Google広告の管理画面と同じ単位）---');
    for (const [id, b] of [...byCampaign].sort((a, c) => c[1].uv.size - a[1].uv.size)) {
      const ch = classifyChannel(
        rows.find((r) => campaignOf.get(r.ip_hash_short) === id && /gad_campaignid/.test(r.url))?.url || ''
      );
      console.log(
        `  ${id}  ${String(b.uv.size).padStart(4)}人  CV ${String(b.cv.size).padStart(3)}件  ` +
          `${pct(b.cv.size, b.uv.size).padStart(6)}  (${ch || '面不明'})`
      );
    }
  }

  // --- 実際の着信との突き合わせ (レイヤー1) --------------------------------
  const telClicks = channels.reduce((n, ch) => n + stats.get(ch).cv['電話'].size, 0);
  let consult = null;
  try {
    const cr = await fetch(`${WORKER}/api/consultations`);
    if (cr.ok) consult = await cr.json();
  } catch { /* 突き合わせは補助情報なので、失敗しても本体は出す */ }

  console.log('\n--- 実際の相談との突き合わせ ---');
  console.log(`計測上の電話クリック（広告経由・訪問者単位）: ${telClicks}件`);
  if (!consult) {
    console.log('手動登録された相談: 取得できませんでした。');
  } else {
    const inWindow = (consult.consultations || []).filter(
      (c) => c.site_id === SITE_ID && c.date >= from && c.date <= effectiveTo
    );
    console.log(`手動登録された相談（${SITE_ID}・同期間）: ${inWindow.length}件`);
    if (telClicks > 0 && inWindow.length === 0) {
      console.log(
        '\n⚠ 電話クリックはあるのに、実際の着信が1件も登録されていません。\n' +
          '  クリックだけで鳴っていないのか、鳴ったが記録していないのかで打ち手が真逆になります。\n' +
          '  ダッシュボードの「相談を登録」で、実際に鳴った分を入れてから再実行してください。'
      );
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
