import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = JSON.parse(readFileSync(join(root, 'lp/content.json'), 'utf8'));
const updates = JSON.parse(readFileSync(join(root, 'lp/updates.json'), 'utf8'));
const areas = ['磐田市', '袋井市', '森町', '掛川市', '菊川市', '御前崎市', '湖西市', '浜松市'];
const origin = 'https://fudosan.atawi.link';
const version = '20261004-referrals';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const formatDate = value => { const [year, month, day] = value.split('-').map(Number); return `${year}年${month}月${day}日`; };
const link = (href, label, attrs = '') => `<a href="${esc(href)}" ${attrs}>${esc(label)}</a>`;
const button = (p, location, label = p.cta) => link('#apply', label, `class="lp-btn" data-lp-event="lp_cta_click" data-location="lp_${location}"`);
function head(title, description, path, schema) {
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}｜富士ヶ丘サービス</title>
<meta name="description" content="${esc(description)}"><link rel="canonical" href="${origin}${path}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin}${path}"><meta property="og:image" content="${origin}/og-image.png">
<meta name="theme-color" content="#0B3C5D"><link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/assets/site-header.css?v=20260724-brand"><link rel="stylesheet" href="/assets/consultation-lp.css?v=${version}">
${schema ? `<script type="application/ld+json">${json(schema)}</script>` : ''}
</head><body class="lp-body">
<a class="lp-skip" href="#main">本文へ移動する</a>
<div class="lp-topline">磐田市見付の富士ヶ丘サービス｜不動産と介護を同じ会社で</div>`;
}
function header(p) {
  return `<header class="lp-header"><div class="lp-wrap">
<a class="lp-brand" href="/"><img src="/karte/assets/img/logo.jpg" alt="富士ヶ丘サービス株式会社" width="358" height="68"><span>ATAWI FUDOSAN</span></a>
<nav class="lp-nav" aria-label="このページの案内">${p ? `${link('#sample', '届く資料の見本')}${link('#faq', 'よくある質問')}${link('#apply', '無料で相談', 'class="lp-nav-apply" data-lp-event="lp_cta_click" data-location="lp_header"')}` : link('/karte/', '無料で相談', 'class="lp-nav-apply"')}</nav>
</div></header>`;
}
function footer() {
  return `<footer class="lp-footer"><div class="lp-wrap"><p>富士ヶ丘サービス株式会社<br>静岡県磐田市見付5789番地1｜静岡県知事(2)第14083号<br>宅地建物取引士 大石浩之（静岡県知事 第027186号）</p><p>${link('tel:0538-31-3308', '0538-31-3308')}｜9:00〜18:00（水曜・日曜は予約制）</p><p>${link('/lp/', '悩み別の相談入口')}　${link('/privacy/', 'プライバシーポリシー')}　${link('/', '総合案内')}</p></div></footer>`;
}
function comparison() {
  return `<section class="lp-section lp-section--tint" aria-labelledby="options-title"><div class="lp-wrap"><p class="lp-kicker">ご家族に合う選択肢を</p><h2 id="options-title">価格だけでなく、費用とこれからの予定を比べます。</h2><div class="lp-option-grid">
<article class="lp-option"><h3>売る</h3><p>売却価格の目安、諸費用、引渡しまでの予定を整理。管理の負担と、手放した後の家族の予定も確認します。</p></article>
<article class="lp-option"><h3>貸す</h3><p>家の状態、想定家賃、修繕・契約の費用を確認。借り手がいる間の利用や将来の売却条件も考えます。</p></article>
<article class="lp-option"><h3>残す</h3><p>使う予定、管理する人、税金・保険・修繕の負担を確認。いつ方針を見直すかも家族で考えます。</p></article>
</div><p class="lp-small" style="margin-top:22px">戸建て賃貸の月々の管理料は0円。修繕費・原状回復費・税金・保険・賃貸借契約時の仲介手数料などは別途です。詳しい条件は${link('/rent/', '戸建て賃貸の案内')}でご確認ください。</p></div></section>`;
}
function form(p) {
  return `<section class="lp-apply" id="apply" aria-labelledby="lp-form-title"><div class="lp-wrap">
<div class="lp-apply-head"><p class="lp-kicker">${p.comparison ? '無料の比較相談' : '無料の実家カルテ'}</p><h2 id="lp-form-title">${esc(p.cta)}</h2><p class="lp-intro">${p.comparison ? '売る・貸す・残すの比較について伺います。必要に応じて、実家カルテで価格目安と確認事項を整理します。' : '物件の価格目安と、確認すべき点、次にすることをまとめます。'}まずは物件の所在地と、初回連絡の方法を教えてください。</p></div>
<noscript><div class="lp-form"><p>このフォームの送信にはJavaScriptが必要です。${link('https://line.me/R/ti/p/%40531nwfsc', 'LINE')}または${link('tel:0538-31-3308', '電話（0538-31-3308）')}でご相談ください。</p></div><style>#lpForm{display:none}</style></noscript>
<form id="lpForm" class="lp-form" action="/api/karte-apply" method="post" data-theme="${p.slug}" data-label="${esc(p.label)}" data-situation="${p.situation}" data-comparison="${!!p.comparison}">
<p><b>相談テーマ：${esc(p.label)}</b></p><p class="lp-form-note">このテーマと入力内容を担当者へ伝えます。この送信だけで売却・賃貸の依頼にはなりません。</p>
<p class="lp-region">対象は${areas.map(esc).join('・')}の物件です。ご依頼者様は県外在住でも相談できます。${link('/areas/', '対応地域の案内')}</p>
<div class="lp-fields"><div class="lp-field"><label for="lpCity">物件の市町村<span class="lp-required">必須</span></label><select id="lpCity" name="city" required><option value="">市町村を選ぶ</option>${areas.map(city => `<option>${city}</option>`).join('')}</select></div><div class="lp-field"><label for="lpTown">町名<span class="lp-required">必須</span></label><input id="lpTown" name="town" autocomplete="address-line1" maxlength="100" placeholder="例：見付" required></div></div>
<div class="lp-field"><label for="lpAddressDetail">番地・地番<span class="lp-optional">任意</span></label><input id="lpAddressDetail" name="addressDetail" maxlength="120" placeholder="例：5789番地1（不明なら空欄）" autocomplete="address-line2"><p class="lp-form-note">番地が分からない場合も、分かる範囲から始められます。写真や書類は受付後、必要に応じてご案内します。</p></div>
<fieldset><legend>初回連絡の方法<span class="lp-required">必須</span></legend><div class="lp-radio-group"><label class="lp-radio"><input type="radio" name="contactMethod" value="email" checked>メール</label><label class="lp-radio"><input type="radio" name="contactMethod" value="phone">電話</label></div></fieldset>
<div class="lp-field" id="lp-email"><label for="lpMail">メールアドレス<span class="lp-required">必須</span></label><input id="lpMail" name="mail" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="例：example@example.com" required></div>
<div class="lp-field" id="lp-phone" hidden><label for="lpTel">電話番号<span class="lp-required">必須</span></label><input id="lpTel" name="tel" type="tel" autocomplete="tel" inputmode="tel" maxlength="30" placeholder="例：090-1234-5678" disabled></div>
<p class="lp-form-note">メールを選んだ方には、初回回答をメールで行います。電話を選んだ方には、資料の受取方法も確認します。</p>
<div class="lp-field"><label for="lpName">お名前<span class="lp-optional">任意</span></label><input id="lpName" name="name" autocomplete="name" maxlength="100"></div>
<div class="lp-field"><label for="lpIntent">今のお考え<span class="lp-optional">任意</span></label><select id="lpIntent" name="intent"><option value="">まだ決まっていない・選ばずに相談する</option><option>売却を検討したい</option><option>賃貸を検討したい</option><option>当面は残したい</option><option${p.comparison ? ' selected' : ''}>売る・貸す・残すを比較したい</option></select></div>
<div class="lp-field"><label for="lpBody">気になること<span class="lp-optional">任意・500文字まで</span></label><textarea id="lpBody" name="body" maxlength="500" placeholder="${esc(p.memoPlaceholder)}"></textarea></div>
<div class="lp-honeypot" aria-hidden="true"><label for="lpCompany">会社名（入力不要）</label><input id="lpCompany" name="company" tabindex="-1" autocomplete="off"></div>
<label class="lp-privacy"><input type="checkbox" name="privacy" required><span>${link('/privacy/', 'プライバシーポリシー')}に同意します。住所・連絡先は、ご相談への対応とカルテ作成に使用します。</span></label>
<p id="lpError" class="lp-error" role="alert" tabindex="-1" hidden></p>
<button class="lp-btn lp-submit" id="lpSubmit" type="submit">${esc(p.submit)}</button>
<p class="lp-form-note">受付後、回答までの目安をご案内します。標準の価格目安・課題整理は無料です。追加業務は内容と費用を事前にご案内します。</p>
<p class="lp-form-fallback">入力が難しい場合は ${link('https://line.me/R/ti/p/%40531nwfsc', 'LINEで相談', 'data-lp-event="lp_line_click" data-location="lp_form"')} ／ ${link('tel:0538-31-3308', '電話：0538-31-3308', 'data-lp-event="lp_phone_click" data-location="lp_form"')}<br><span class="lp-small">電話受付 9:00〜18:00（水曜・日曜は予約制）</span></p>
</form></div></section>`;
}
function render(p) {
  const commonFaqs = [
    ['無料なのは、どこまでですか？', '机上の価格目安、標準的な資料取得、課題・対応順序の整理は継続して無料です。追加の現地調査、測量、登記、建物検査、片付けなどを依頼する場合は、内容と費用を事前にご案内します。'],
    ['申し込んだら、売らなければいけませんか？', '売却を決めていなくても申し込めます。結果を確認してから、売る・貸す・残すを考えられます。追加の相談に進むかどうかもお選びいただけます。'],
    ['いつ回答が届きますか？', '受付内容と物件所在地を確認した後、回答までの目安をご案内します。追加資料が必要な場合も、その際にお伝えします。']
  ];
  const faqs = [...p.faqs, ...commonFaqs];
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Service', name: p.title, url: `${origin}/lp/${p.slug}/`, description: p.lead, areaServed: areas, provider: { '@type': 'RealEstateAgent', name: '富士ヶ丘サービス株式会社', url: origin, telephone: '0538-31-3308', address: { '@type': 'PostalAddress', addressRegion: '静岡県', addressLocality: '磐田市', streetAddress: '見付5789番地1', addressCountry: 'JP' } } },
    { '@type': 'FAQPage', mainEntity: faqs.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  ] };
  return `${head(p.title, p.lead, `/lp/${p.slug}/`, schema)}${header(p)}
<main id="main">
<section class="lp-hero"><div class="lp-wrap"><div class="lp-hero-grid"><div>
<span class="lp-tag">${esc(p.label)}の相談</span><h1>${p.headline.map(line => `<span>${esc(line)}</span>`).join('')}</h1><p class="lp-lead">${esc(p.lead)}</p><div class="lp-actions">${button(p,'hero')}</div><p class="lp-hero-note">相談・標準の実家カルテは無料。売却未定でも大丈夫です。</p>${link('#sample', 'まず、届く資料の見本を見る', 'data-lp-event="lp_sample_click" data-location="lp_hero"')}
</div><figure class="lp-hero-figure"><img class="lp-hero-photo" src="${p.image}" width="880" height="660" alt="${esc(p.imageAlt)}" fetchpriority="high"><figcaption>${esc(p.imageCaption)}</figcaption></figure></div>
<div class="lp-promises"><div><b>価格の目安</b>根拠と条件を添えて</div><div><b>確認すべき課題</b>事実と未確認点を分けて</div><div><b>次にすること</b>ご家族の予定に合わせて</div></div></div></section>
<section class="lp-section" aria-labelledby="concerns-title"><div class="lp-wrap"><p class="lp-kicker">こんなことで、止まっていませんか</p><h2 id="concerns-title">${esc(p.label)}。<br>分からないことから、相談できます。</h2><div class="lp-grid3">${p.concerns.map(([title,text],i) => `<article class="lp-concern"><span class="lp-number">0${i+1}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')}</div></div></section>
<section class="lp-section lp-section--tint" id="sample" aria-labelledby="sample-title"><div class="lp-wrap"><p class="lp-kicker">申し込むと、何が分かる？</p><h2 id="sample-title">価格・課題・次にすることを、一つの資料に。</h2><p class="lp-intro">${p.comparison ? '比較相談の中で必要に応じて、実家カルテをご案内します。' : '宅建士が、物件ごとに実家カルテを作成します。'}金額だけを出して終わらず、何を確認してから判断するかも整理します。</p>
<div class="lp-sample-grid"><figure class="lp-sample-visual"><img src="/assets/karte-preview.svg" alt="価格の目安、確認事項、次の対応を示す実家カルテの構成見本" width="497" height="702" loading="lazy"><figcaption>実家カルテの構成見本</figcaption></figure>
<div><article class="lp-sheet"><div class="lp-sheet-label"><b>ふじがおか実家カルテ</b><span>架空の確認例</span></div><h3>${esc(p.sampleTitle)}</h3>
<div class="lp-sample-block"><h4>01｜机上の価格目安</h4><p>所在地・面積・建物情報などから個別に算定。算定日、根拠と未確認条件を添えます。</p></div>
<div class="lp-sample-block"><h4>02｜確認した事実と、まだ分からないこと</h4><p><span class="lp-badge">確認する例</span><br>${esc(p.sampleFacts)}</p><p><span class="lp-badge">追加確認の例</span><br>${esc(p.sampleUnknown)}</p></div>
<div class="lp-sample-block"><h4>03｜次にすること</h4><ol>${p.sampleSteps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></article>
<p class="lp-example-note">上の内容は説明用の架空の確認例です。実在の物件や対応実績ではありません。実際の価格・課題は個別に調べ、価格を算定できない場合は理由と必要な情報をご案内します。</p>
<div class="lp-actions">${button(p,'sample')}${link('/karte/sample/', '金額入りの詳しい見本を読む', 'data-lp-event="lp_sample_click" data-location="lp_sample"')}</div></div></div></div></section>
<section class="lp-section" aria-labelledby="reason-title"><div class="lp-wrap"><div class="lp-reason-grid"><div><p class="lp-kicker">富士ヶ丘サービスに相談する理由</p><h2 id="reason-title">${esc(p.reasonTitle)}</h2><p>${esc(p.reason)}</p><div class="lp-person"><img src="/assets/photos/oishi-fist-sax-wide-v2.png" width="86" height="86" alt="宅地建物取引士 大石浩之" loading="lazy"><div><b>確認するのは、宅建士 大石浩之です。</b><span>富士ヶ丘サービス株式会社 代表取締役</span><span>宅地建物取引士（静岡県知事 第027186号）</span></div></div></div><figure><img class="lp-photo" src="${p.reasonPhoto}" width="880" height="586" alt="${esc(p.reasonPhotoAlt)}" loading="lazy"><figcaption>${esc(p.reasonPhotoAlt)}。当社の実際の写真です。</figcaption></figure></div><div class="lp-unique"><h3>${esc(p.uniqueTitle)}</h3><p>${esc(p.uniqueText)}</p></div></div></section>
<section class="lp-section lp-section--tint" aria-labelledby="case-title"><div class="lp-wrap"><p class="lp-kicker">公開済みの対応を確認できます</p><h2 id="case-title">${esc(p.caseTitle)}</h2><div class="lp-case"><div><p class="lp-case-kind">${esc(p.caseLabel)}</p><p>説明用の見本とは別に、<br>実際の対応をご紹介します。</p></div><div><p>${esc(p.caseText)}</p>${link(p.caseUrl, '対応の経緯と原掲載を読む', 'data-lp-event="lp_case_click" data-location="lp_body"')}</div></div><p class="lp-real-note">個別の対応事例であり、同じ結果・期間を保証するものではありません。</p></div></section>
${p.comparison ? comparison() : ''}
<section class="lp-section" aria-labelledby="flow-title"><div class="lp-wrap"><p class="lp-kicker">相談から、結果の確認まで</p><h2 id="flow-title">申込時に、結論を決める必要はありません。</h2><ol class="lp-flow"><li><h3>物件と希望を教える</h3><p>市町村・町名、分かる範囲の番地、希望する連絡方法を入力します。</p></li><li><h3>確認する範囲を整理</h3><p>物件を特定し、回答までの目安と、追加で必要な資料があればご案内します。</p></li><li><h3>結果を見てから相談</h3><p>${p.comparison ? '選択肢と比較に必要な確認点をご案内。必要に応じて実家カルテも作成します。' : '価格目安・課題・次の対応をお届け。現地確認や具体的な相談へ進むか、ご家族で考えられます。'}</p></li></ol><div class="lp-cost"><p><b>無料の範囲</b>｜机上の価格目安・標準的な資料取得・課題と対応順序の整理。</p><p>現地調査や専門家業務などを追加で希望する場合は、内容と費用を事前にご案内します。カルテは、境界確定・法律や税務の個別判断・建物検査の代わりにはなりません。</p></div></div></section>
<section class="lp-section lp-section--tint" id="faq" aria-labelledby="faq-title"><div class="lp-wrap lp-faq"><p class="lp-kicker">申込み前の気になること</p><h2 id="faq-title">${esc(p.label)}のよくある質問</h2>${faqs.map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
${form(p)}
<section class="lp-after"><div class="lp-wrap"><h2>結果を見てから、次の選択肢へ。</h2><p>売る・貸す・残す。どの方向へ進むかは、ご希望と確認結果をもとに考えます。売却を希望される方には販売方針と事例を、賃貸を検討される方には費用と条件をご案内します。</p><div class="lp-after-links">${link('https://baikyaku.atawi.link/', '売却の販売方針と事例を見る', 'data-lp-event="lp_sale_click" data-location="lp_body"')}${link('/rent/', '賃貸の費用と条件を見る', 'data-lp-event="lp_rent_click" data-location="lp_body"')}${link(p.guide, p.guideLabel)}${link('/lp/', 'ほかの悩みから相談する')}</div></div></section>
</main>${footer()}
<div class="lp-sticky" id="lpSticky" aria-label="相談の入口"><p>標準の実家カルテ・相談は無料</p>${button(p,'sticky',p.shortCta)}${link('tel:0538-31-3308', '電話で相談', 'data-lp-event="lp_phone_click" data-location="lp_sticky"')}</div>
<script src="/assets/karte-context.js?v=20261001"></script><script src="/assets/consultation-measurement.js?v=${version}"></script>
<script>if(window.fgaMeasurement&&!window.fgaMeasurement.excluded){window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};gtag('js',new Date());gtag('config','AW-18409604033');var tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id=AW-18409604033';document.head.appendChild(tag);}</script>
<script defer src="/assets/ads-conversion.js?v=20260930-measurement"></script><script defer src="/assets/consultation-lp.js?v=${version}"></script>
</body></html>`;
}

for (const p of pages) {
  const dir = join(root, 'lp', p.slug); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), render(p));
}
const hub = `${head('実家・空き家の悩み別相談｜6つの入口', '親の施設入居、相続、遠方の空き家、荷物、古い家、売るか貸すか。状況に合う入口から、価格目安と課題・次にすることを無料で相談できます。', '/lp/')}${header()}
<main id="main"><section class="lp-hub-hero"><div class="lp-wrap"><p class="lp-kicker">ふじがおか実家カルテ・無料相談</p><h1>実家のこと。<br>いまの悩みから、始められます。</h1><p class="lp-intro">売ると決めていなくても大丈夫です。近い状況を選ぶと、確認できること、届く資料、相談の流れをご覧いただけます。</p><p>物件の対象地域：${areas.join('・')}。県外にお住まいのご家族からも相談できます。</p></div></section><section class="lp-section"><div class="lp-wrap"><div class="lp-hub-grid">${pages.map((p,i) => `<a class="lp-hub-card" href="/lp/${p.slug}/"><img src="${p.image}" alt="${esc(p.imageAlt)}" width="440" height="250" loading="lazy"><div><span>0${i+1}｜${esc(p.label)}</span><h2>${esc(p.headline.join(''))}</h2><p>${esc(p.concerns[0][1])}</p><span>確認できることと、無料相談を見る</span></div></a>`).join('')}</div><p class="lp-small" style="margin-top:30px">各ページの写真には当社の写真と住宅のイメージが含まれます。個別物件の掲載ではありません。</p><div class="lp-actions">${link('/karte/', '状況が分からなくても、無料で相談する', 'class="lp-btn"')}${link('/', 'サービス全体の案内を見る')}${link('/lp/updates/', '更新・改修履歴を見る')}</div></div></section></main>${footer()}</body></html>`;
writeFileSync(join(root, 'lp/index.html'), hub);

const updatesPage = `${head('実家カルテの更新・改修履歴', '実家カルテの相談ページで、読者向けに変更した内容と対象ページを日付順にお知らせします。', '/lp/updates/')}${header()}
<main id="main"><section class="lp-hub-hero"><div class="lp-wrap"><p class="lp-kicker">ふじがおか実家カルテ</p><h1>更新・改修履歴</h1><p class="lp-intro">相談ページで読者向けに変更した内容を、確認できた改修日と対象ページとともに掲載します。</p><p class="lp-small">この履歴ページの公開日：2026年10月5日。以下の日付は、それぞれの改修を行った日です。</p></div></section><section class="lp-section"><div class="lp-wrap lp-faq">${updates.map(item => `<article class="lp-cost"><p class="lp-kicker"><time datetime="${esc(item.date)}">${esc(formatDate(item.date))}</time></p><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p><div class="lp-after-links">${item.links.map(itemLink => link(itemLink.href, itemLink.label)).join('')}</div></article>`).join('')}<div class="lp-actions">${link('/lp/', '悩み別の相談入口へ戻る', 'class="lp-btn lp-btn--secondary"')}</div></div></section></main>${footer()}</body></html>`;
const updatesDir = join(root, 'lp', 'updates'); mkdirSync(updatesDir, { recursive: true });
writeFileSync(join(updatesDir, 'index.html'), updatesPage);

// Add the new canonical routes once without rebuilding unrelated sitemap entries.
const sitemapPath = join(root, 'sitemap-core.xml');
let sitemap = readFileSync(sitemapPath, 'utf8');
const routes = [
  { path: '/lp/', lastmod: '2026-10-05' },
  ...pages.map(p => ({ path: `/lp/${p.slug}/`, lastmod: '2026-10-04' })),
  { path: '/lp/updates/', lastmod: '2026-10-05' },
];
for (const { path, lastmod } of routes) {
  const entry = `<url><loc>${origin}${path}</loc><lastmod>${lastmod}</lastmod></url>`;
  const pattern = new RegExp(`<url><loc>${origin}${path}</loc><lastmod>[^<]+</lastmod></url>`);
  sitemap = pattern.test(sitemap) ? sitemap.replace(pattern, entry) : sitemap.replace('</urlset>', `  ${entry}\n</urlset>`);
}
writeFileSync(sitemapPath, sitemap);
console.log(`Generated ${pages.length} consultation LPs, the theme index and the update history.`);
