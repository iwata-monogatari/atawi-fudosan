import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const today = "2026-07-21";

const cityData = {
  iwata: {
    name: "磐田市",
    kana: "いわたし",
    parent: "/areas/iwata/",
    nearby: [
      ["袋井市", "/areas/fukuroi/"],
      ["掛川市", "/areas/kakegawa/"],
      ["森町", "/areas/mori/"],
    ],
    areaNote:
      "磐田市は富士ヶ丘サービスの所在地でもあり、見付・中泉・豊田・竜洋・福田・豊岡など市内の旧町村部を含めて相談を受けています。市街地の宅地だけでなく、農地を含む実家、古い集落内の宅地、筆が複数に分かれる土地では、売却や管理の前に名義、道路、地目、境界、建物の状態を分けて確認する必要があります。",
    publicNote:
      "磐田市の空き家相談、空き家バンク、危険空き家の解体支援などの公的制度は、家の状態や所有者の状況によって入口が変わります。制度を使うかどうかを決める前に、対象になる土地建物の範囲、登記名義、管理状況を整理しておくと相談が進めやすくなります。",
  },
  fukuroi: {
    name: "袋井市",
    kana: "ふくろいし",
    parent: "/areas/fukuroi/",
    nearby: [
      ["磐田市", "/areas/iwata/"],
      ["掛川市", "/areas/kakegawa/"],
      ["森町", "/areas/mori/"],
    ],
    areaNote:
      "袋井市では、住宅地と農地が近い地域、旧集落の家、遠方のご家族が管理している実家の相談が出やすくなります。袋井駅周辺や市街地だけでなく、浅羽方面、旧東海道沿い、郊外の宅地では、固定資産税通知書に載る土地建物と現地で見えている家の範囲が一致しないこともあります。",
    publicNote:
      "袋井市には、すまいの相談センター、空家等対策、空家等相続相談業務など、空き家と相続に関係する公的な相談先があります。制度へ相談する前に、物件の住所、固定資産税通知書、登記名義、家族の方針を整理しておくと、相談先で聞かれる内容に答えやすくなります。",
  },
};

const issues = {
  "souzoku-touki": {
    label: "相続登記が終わっていない",
    short: "亡くなった親名義のまま、または相続人が複数いて方針が止まっている実家の確認。",
    h1: (city) => `${city.name}で相続登記が終わっていない実家をどう進めるか`,
    title: (city) => `${city.name}で相続登記が終わっていない実家の相談｜名義確認と売却前の整理`,
    description: (city) =>
      `${city.name}で亡くなった親名義のままの実家、相続登記前の空き家、兄弟共有になる土地建物の相談へ。売却や空き家バンクの前に、登記名義、相続人、固定資産税通知書、道路、農地、境界を整理します。`,
    lead: (city) =>
      `${city.name}の実家が亡くなった親名義のままでも、すぐに売却できないと決めつける必要はありません。ただし、買主へ所有権を移すには、相続人を確定し、誰が引き継ぐのかを決め、相続登記を済ませる必要があります。ふじがおか実家カルテでは、登記情報と固定資産税通知書を入口に、売却や管理の前に止まりやすい点を先に整理します。`,
    points: [
      "登記名義が誰になっているかを確認する",
      "相続人が何人いるか、話し合いの相手を整理する",
      "抵当権や差押えなど、相続登記以外の権利も見る",
      "売却、管理、空き家バンク相談の前に必要な順番を分ける",
    ],
    checks: [
      "固定資産税通知書に載っている土地建物の数",
      "亡くなった方の名義、共有名義、古い名義の有無",
      "地番と住所の違い、複数筆の有無",
      "司法書士へつなぐ前に家族で確認しておくこと",
    ],
    karte:
      "カルテでは、相続登記が必要かどうか、他に売却前の支障が残っていないか、誰に相談すべきかを1冊にまとめます。司法書士への相談が必要な場合も、相談前に物件の状態を整理できます。",
  },
  "oyaga-shisetsu": {
    label: "親が施設に入った後の家",
    short: "まだ売ると決めていない段階で、管理、荷物、名義、本人意思を分けて考える入口。",
    h1: (city) => `${city.name}で親が施設に入った後の実家をどうするか`,
    title: (city) => `${city.name}で親が施設に入った後の実家相談｜空き家管理と家族会議の準備`,
    description: (city) =>
      `${city.name}で親が施設に入った後の実家、荷物が残った家、空き家になり始めた家の相談へ。売却を急がず、本人意思、管理、固定資産税、名義、荷物、建物状態を整理します。`,
    lead: (city) =>
      `${city.name}で親が施設に入った後の家は、売る、貸す、残すをすぐに決めにくいものです。本人の意思確認、通院や一時帰宅の可能性、荷物の整理、空き家管理、固定資産税の負担が重なります。まずは家族会議で話す材料をそろえることが、後回しによる傷みやトラブルを防ぎます。`,
    points: [
      "本人の意思確認ができる段階かを分ける",
      "誰が鍵、郵便、庭木、通風を管理するか決める",
      "固定資産税通知書から維持費と物件範囲を確認する",
      "売却査定の前に、道路や名義の支障を先に見る",
    ],
    checks: [
      "施設入居後に空き家期間がどれくらい続いているか",
      "荷物、仏壇、車、農機具、庭木の扱い",
      "本人、子、兄弟姉妹の希望の違い",
      "現地確認が必要な建物の傷みや近隣への影響",
    ],
    karte:
      "カルテは価格査定ではなく、家族で話すための状態整理です。住所や固定資産税通知書から、名義、道路、土地建物の範囲、災害情報を確認し、現地で見るべき点と机上で分かる点を分けます。",
  },
  "koteishisanzei": {
    label: "固定資産税通知書だけある",
    short: "住所や地番があいまいでも、通知書を手がかりに土地建物の全体像を見る。",
    h1: (city) => `${city.name}で固定資産税通知書だけある実家の調べ方`,
    title: (city) => `${city.name}の固定資産税通知書から実家を整理｜土地建物・名義・地番確認`,
    description: (city) =>
      `${city.name}の実家について固定資産税通知書だけ手元にある方へ。土地建物の範囲、地番、課税内容、名義、農地や古い建物の有無を整理し、相続・売却・管理の前に確認する順番をまとめます。`,
    lead: (city) =>
      `${city.name}の実家で、住所は分かるが地番が分からない、家族の手元に固定資産税通知書だけ届いている、という相談は少なくありません。通知書には土地と建物の課税情報が載っており、どの土地が対象か、家屋が何棟あるか、農地や雑種地が含まれるかを確認する入口になります。`,
    points: [
      "通知書に載る土地、家屋、地目、面積を整理する",
      "住所と地番が違う場合に、登記情報へつなげる",
      "課税されている建物と現地の建物が合うかを見る",
      "相続、売却、解体、管理のどれに進むかを分ける",
    ],
    checks: [
      "土地が1筆か複数筆か",
      "宅地以外に田、畑、山林、雑種地が含まれるか",
      "家屋番号、構造、建築年、床面積",
      "納税通知書の宛名と登記名義が一致しているか",
    ],
    karte:
      "通知書の写真やPDFだけでも入口になります。カルテでは、通知書に載る情報を登記、公図、都市計画、ハザード情報と照らし、家族が次に確認すべき点を整理します。",
  },
  "akiya-bank-mae": {
    label: "空き家バンクや売却の前に確認",
    short: "掲載や査定の前に、売れる状態か、貸せる状態か、支障がないかを確認する。",
    h1: (city) => `${city.name}で空き家バンクや売却の前に確認したいこと`,
    title: (city) => `${city.name}の空き家バンク・売却前チェック｜名義・道路・農地・残置物`,
    description: (city) =>
      `${city.name}で空き家バンク掲載、売却査定、解体、賃貸活用を考える前に確認したい名義、相続登記、接道、農地、境界、残置物、建物状態を宅建士が整理します。`,
    lead: (city) =>
      `${city.name}で空き家バンクや売却査定に進む前に、まず確認したいのは価格だけではありません。名義が古い、道路に接していない、農地が含まれる、境界が分からない、荷物が残っているといった支障があると、掲載や売却活動の途中で止まることがあります。`,
    points: [
      "売却、賃貸、空き家バンク、解体のどれを選ぶかを分ける",
      "相続登記、抵当権、共有者の同意を確認する",
      "接道、セットバック、再建築の可能性を見る",
      "残置物、庭木、越境、建物傷みを現地確認項目に分ける",
    ],
    checks: [
      "所有者本人が相談できる状態か",
      "買主や利用者に説明が必要な道路、農地、災害情報",
      "建物付きで進めるか、解体後に進めるか",
      "市の制度や民間査定に相談する前に必要な資料",
    ],
    karte:
      "カルテは査定価格を出す資料ではありません。空き家バンクや売却相談に持っていく前の下調べとして、支障になりやすい項目と解消の順番を整理します。",
  },
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pageHtml(cityKey, issueKey) {
  const city = cityData[cityKey];
  const issue = issues[issueKey];
  const url = `https://fudosan.atawi.link/areas/${cityKey}/${issueKey}/`;
  const rel = `/areas/${cityKey}/${issueKey}/`;
  const relatedLinks = Object.entries(issues)
    .filter(([key]) => key !== issueKey)
    .map(([key, item]) => `<a href="/areas/${cityKey}/${key}/">${esc(city.name)}・${esc(item.label)}</a>`)
    .join("");
  const nearbyLinks = city.nearby
    .map(([label, href]) => `<a href="${href}">${esc(label)}</a>`)
    .join("");
  const otherCity = cityKey === "iwata" ? "fukuroi" : "iwata";
  const sameIssueOtherCity = `<a href="/areas/${otherCity}/${issueKey}/">${esc(cityData[otherCity].name)}・${esc(issue.label)}</a>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(issue.title(city))}</title>
<meta name="description" content="${esc(issue.description(city))}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="ja_JP">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(issue.title(city))}">
<meta property="og:description" content="${esc(issue.description(city))}">
<meta property="og:image" content="https://fudosan.atawi.link/og-image.png">
<meta name="theme-color" content="#0090D0">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/karte/assets/atawi.css">
<style>
.issue-hero{background:linear-gradient(180deg,#EAF6FB,#FBFAF6);padding:58px 0 42px}
.issue-hero h1{font-size:clamp(27px,4.8vw,44px);margin:.35em 0 .45em;line-height:1.45}
.issue-hero p{max-width:860px;color:var(--sub);font-size:17px}
.issue-main{padding:54px 0}
.issue-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:22px;align-items:start}
.issue-panel{background:#fff;border:1px solid var(--line);border-radius:10px;padding:24px}
.issue-panel h2{font-size:22px;margin:0 0 12px}
.issue-panel h3{font-size:18px;margin:22px 0 8px}
.issue-panel p,.issue-panel li{color:var(--sub);font-size:15px;line-height:1.9}
.issue-panel ul{margin-left:1.2em}
.issue-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.issue-list li{background:#f7fbff;border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.karte-box{border-left:5px solid var(--org);background:#fffaf2}
.link-cloud{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.link-cloud a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 14px;text-decoration:none;font-family:var(--maru);font-size:13px;color:var(--blue-d)}
.faq{padding:48px 0;background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.faq details{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:10px 0}
.faq summary{cursor:pointer;font-weight:700;color:var(--blue-d)}
@media(max-width:840px){.issue-grid{grid-template-columns:1fr}.issue-hero{padding:42px 0 32px}}
</style>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "トップ", item: "https://fudosan.atawi.link/" },
      { "@type": "ListItem", position: 2, name: "対応地域", item: "https://fudosan.atawi.link/areas/" },
      { "@type": "ListItem", position: 3, name: city.name, item: `https://fudosan.atawi.link${city.parent}` },
      { "@type": "ListItem", position: 4, name: issue.label, item: url },
    ],
  })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${city.name}の住所だけでも相談できますか。`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "住所だけでも入口になります。固定資産税通知書、登記情報、現地写真があると、土地建物の範囲や確認項目をより正確に整理できます。",
        },
      },
      {
        "@type": "Question",
        name: "売却を決めていなくても利用できますか。",
        acceptedAnswer: {
          "@type": "Answer",
          text: "利用できます。ふじがおか実家カルテは査定ではなく、売る、残す、貸す、解体する前に家の状態と次の確認順を整理する資料です。",
        },
      },
    ],
  })}</script>
</head>
<body>
<div class="topbar">${esc(city.name)}の実家じまい・相続空き家相談｜住所や固定資産税通知書から確認できます</div>
<header><div class="wrap hd"><a class="brand" href="/"><img class="logo-img" src="/karte/assets/img/logo.jpg" alt="富士ヶ丘サービス株式会社" width="358" height="68"><span class="mark">ATAWI FUDOSAN</span><span class="co">宅建士 大石浩之</span></a><nav class="gnav" aria-label="メイン"><a href="/#karte">実家カルテとは</a><a href="/karte/sample/">見本を見る</a><a href="/karte/checklist/">住所で分かること</a><a href="/areas/">対応地域</a><a href="/karte/">申し込む</a></nav></div></header>
<main>
  <section class="issue-hero"><div class="wrap"><p class="eyebrow">${city.name.toUpperCase()} ISSUE</p><h1>${esc(issue.h1(city))}</h1><p>${esc(issue.lead(city))}</p><div class="cta" style="margin-top:22px"><a class="btn btn-org" href="/karte/">カルテを申し込む</a><a class="btn btn-ghost" href="https://line.me/R/ti/p/%40531nwfsc">LINEで相談する</a></div></div></section>
  <section class="issue-main"><div class="wrap issue-grid">
    <article class="issue-panel">
      <h2>まず確認すること</h2>
      <ul class="issue-list">${issue.points.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>
      <h3>${esc(city.name)}で気をつけたい地域事情</h3>
      <p>${esc(city.areaNote)}</p>
      <h3>公的制度や相談先へ行く前に</h3>
      <p>${esc(city.publicNote)}</p>
    </article>
    <aside class="issue-panel">
      <h2>手元にあると進めやすいもの</h2>
      <ul>${issue.checks.map((check) => `<li>${esc(check)}</li>`).join("")}</ul>
      <div class="issue-panel karte-box" style="margin-top:18px">
        <h3>ふじがおか実家カルテでできること</h3>
        <p>${esc(issue.karte)}</p>
      </div>
    </aside>
  </div></section>
  <section class="faq"><div class="wrap">
    <p class="eyebrow">FAQ</p>
    <h2>${esc(city.name)}の実家相談でよくある質問</h2>
    <details><summary>住所だけでも相談できますか。</summary><p>はい。番地や地番があいまいでも、分かる範囲の住所、固定資産税通知書、現地写真があれば入口になります。</p></details>
    <details><summary>売却査定とは違いますか。</summary><p>違います。カルテは価格を出さず、名義、道路、農地、境界、建物、災害情報など、売る前・残す前に確認すべきことを整理します。</p></details>
    <details><summary>${esc(city.name)}以外の近隣市町でも相談できますか。</summary><p>磐田市、袋井市、掛川市、森町、浜松市の一部を中心に対応しています。エリア外の場合も、確認項目リストとして整理できます。</p></details>
    <div class="link-cloud">${relatedLinks}${sameIssueOtherCity}${nearbyLinks}<a href="/areas/">対応地域一覧</a></div>
  </div></section>
  <section class="cta-band sunrise"><div class="wrap"><h2>${esc(city.name)}の実家住所を送ってください。</h2><p>この時点では売却依頼にはなりません。住所や固定資産税通知書から、まず確認すべき順番を整理します。</p><div class="cta"><a class="btn btn-org" href="/karte/">カルテを申し込む</a><a class="btn btn-ghost-inv" href="https://line.me/R/ti/p/%40531nwfsc">LINEで相談する</a></div></div></section>
</main>
<footer><div class="wrap"><div class="ft-grid"><div><h5>ATAWI FUDOSAN</h5><p class="ft-co">富士ヶ丘サービス株式会社<br>静岡県磐田市見付5789番地1<br>TEL:0538-31-3308<br>静岡県知事(2)第14083号</p></div><div><h5>ふじがおか実家カルテ</h5><ul><li><a href="/karte/">申し込む</a></li><li><a href="/karte/sample/">見本を見る</a></li><li><a href="/karte/checklist/">住所で分かること</a></li><li><a href="/karte/cases/">相談事例</a></li></ul></div><div><h5>対応地域</h5><ul><li><a href="/areas/">地域一覧</a></li><li><a href="/areas/iwata/">磐田市</a></li><li><a href="/areas/fukuroi/">袋井市</a></li><li><a href="/areas/kakegawa/">掛川市</a></li><li><a href="/areas/mori/">森町</a></li></ul></div></div><p class="copy">&copy; 富士ヶ丘サービス株式会社 ATAWI FUDOSAN</p></div></footer>
<div class="mcv"><a class="k" href="/karte/">カルテ申込</a><a class="t" href="tel:0538-31-3308">電話</a><a class="l" href="https://line.me/R/ti/p/%40531nwfsc">LINE</a></div>
<script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script>
</body>
</html>
`;
}

function writeIssuePages() {
  for (const cityKey of Object.keys(cityData)) {
    for (const issueKey of Object.keys(issues)) {
      const file = join(root, "areas", cityKey, issueKey, "index.html");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, pageHtml(cityKey, issueKey), "utf8");
    }
  }
}

function updateParentPage(cityKey) {
  const file = join(root, "areas", cityKey, "index.html");
  let html = readFileSync(file, "utf8");
  if (html.includes("AREA ISSUE LINKS")) return;
  const city = cityData[cityKey];
  const cards = Object.entries(issues)
    .map(
      ([key, issue]) =>
        `<a class="local-card" href="/areas/${cityKey}/${key}/"><h2>${esc(city.name)}・${esc(issue.label)}</h2><p>${esc(issue.short)}</p></a>`
    )
    .join("");
  const section = `  <section class="local-main">
    <div class="wrap">
      <p class="eyebrow">AREA ISSUE LINKS</p>
      <h2>${esc(city.name)}の状況別相談入口</h2>
      <div class="local-grid">${cards}</div>
    </div>
  </section>
`;
  html = html.replace("  <section class=\"cta-band sunrise\">", `${section}  <section class="cta-band sunrise">`);
  writeFileSync(file, html, "utf8");
}

function updateAreaIndex() {
  const file = join(root, "areas", "index.html");
  let html = readFileSync(file, "utf8");
  if (html.includes("重点市町の状況別ページ")) return;
  const cityLinks = Object.entries(cityData)
    .map(([cityKey, city]) => {
      const links = Object.entries(issues)
        .map(([issueKey, issue]) => `<li><a href="/areas/${cityKey}/${issueKey}/">${esc(city.name)}・${esc(issue.label)}</a></li>`)
        .join("");
      return `<div class="theme-card"><h2>${esc(city.name)}</h2><ul>${links}</ul></div>`;
    })
    .join("");
  const section = `  <section class="theme-section">
    <div class="wrap">
      <p class="eyebrow">LOCAL INTENT</p>
      <h2>重点市町の状況別ページ</h2>
      <div class="theme-grid">${cityLinks}</div>
    </div>
  </section>
`;
  html = html.replace("  <section class=\"scope\">", `${section}  <section class="scope">`);
  writeFileSync(file, html, "utf8");
}

function updateSitemap() {
  const file = join(root, "sitemap.xml");
  let xml = readFileSync(file, "utf8");
  const newUrls = [];
  for (const cityKey of Object.keys(cityData)) {
    for (const issueKey of Object.keys(issues)) {
      const loc = `https://fudosan.atawi.link/areas/${cityKey}/${issueKey}/`;
      if (!xml.includes(`<loc>${loc}</loc>`)) {
        newUrls.push(`  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`);
      }
    }
  }
  if (newUrls.length) {
    xml = xml.replace("</urlset>", `${newUrls.join("\n")}\n</urlset>`);
    writeFileSync(file, xml, "utf8");
  }
}

writeIssuePages();
updateParentPage("iwata");
updateParentPage("fukuroi");
updateAreaIndex();
updateSitemap();
