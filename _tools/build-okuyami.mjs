/* 磐田おくやみ窓口（/souzoku/okuyami/）— 6ページの生成エントリポイント
 *
 *   node site/_tools/build-okuyami.mjs
 *
 * 窓口名・電話・持ち物・CTA文言は souzoku/okuyami/okuyami-data.json、
 * 国の手続きの期限は souzoku/okuyami/national-deadlines.json が正本。
 * 本文（読み物としての地の文）だけがこのファイルにある。
 */
import {
  page, aioBlock, deadlineAlert, strongCard, buildingMap,
  esc, telLink, anchor, win, bld, q, ext, D, ND, CTA,
} from './okuyami-lib.mjs';

console.log('磐田おくやみ窓口を生成します…');

const AQ = CTA.aio_qa_okuyami;

/* ================================================================== */
/* 1. index.html — 親ページ                                            */
/* ================================================================== */

const timeline = [
  {
    when: '7日以内',
    h: 'まず期限があるものだけ',
    p: 'この時期に動くのは、期限が決まっているものだけで十分です。死亡届は多くの場合、葬儀会社が提出しています。',
    li: ['死亡届の提出（知った日から7日以内）', '火葬・埋葬の許可', '児童手当を受けていた場合は15日以内'],
    link: { url: 'deadline.html', label: '期限のある手続きを見る' },
  },
  {
    when: '14日前後',
    h: '市役所と、市役所以外',
    p: '保険証や手帳の返納、口座の名義変更など、件数がいちばん多い時期です。窓口が5か所に分かれているため、順路を決めてから行くと一度で済みます。',
    li: ['国民健康保険・後期高齢者医療・介護保険', '水道・市税の口座振替', '年金・金融機関・免許証など'],
    link: { url: 'cityhall.html', label: '市役所での手続きを見る' },
  },
  {
    when: '落ち着いてから',
    h: '家と土地のこと',
    p: '相続登記や不動産のことは、この段階からで大丈夫です。ただし相続放棄は3か月、相続税は10か月と期限があるため、心当たりがあれば早めにご確認ください。',
    li: ['相続登記（令和6年4月から義務化）', '未登記家屋・農地・山林の届出', '固定資産税の納税義務者の変更'],
    link: { url: 'touki.html', label: '相続登記について見る' },
  },
];

page({
  file: 'index.html',
  title: '磐田市で家族を亡くしたあとの手続き一覧｜磐田おくやみ窓口（相続はじめ）',
  description: '磐田市で家族を亡くされた方へ。市役所の窓口・持ち物・電話番号と、市役所以外の手続きを一か所に整理しました。当てはまるものを選ぶだけで、回る順路表を作れます。',
  eyebrow: '磐田おくやみ窓口',
  h1: '家族を亡くしたあとの手続き、ぜんぶここから。',
  lead: '磐田市で家族を亡くされた方向けに、市役所・市役所以外の手続きを一か所に整理しました。',
  faq: [
    [AQ.q, AQ.a],
    ['磐田市の手続きの窓口はどこにありますか。', '市役所本庁舎1階・iプラザ3階・市役所西庁舎1階・市役所西庁舎2階・福田支所2階の5か所に分かれています。ただし国民健康保険・介護保険・障害者手帳などの返納は、本庁舎1階の市民課窓口グループや各支所でも受け付けています。'],
    ['手続きはいつまでに行けばよいですか。', '死亡届は亡くなられたことを知った日から7日以内です。児童手当を受け取っていた場合の受給者変更は死亡日の翌日から15日以内です。それ以外の市役所の手続きに一律の期限はありませんが、保険証の返納や口座振替の停止は早めに行うほうが行き違いが起きません。'],
  ],
  extraScripts: '  <script src="checker.js" defer></script>\n',
  body: `    <section class="section">
      <div class="wrap narrow">
        ${aioBlock(AQ.q, AQ.a)}
        <p>葬儀が終わったあと、市役所から渡された案内を前にして、何から手をつければよいか分からなくなる方は少なくありません。磐田市の手続きは窓口が5か所に分かれていて、故人の状況によって回る場所が変わります。このページでは、当てはまるものを選ぶだけで「どこへ、何を持って行くか」の順路表を作れるようにしました。</p>
        <p>急がなくて大丈夫です。期限が決まっているものはごくわずかで、そのほかは落ち着いてからで間に合います。まずは期限のあるものから確認してください。</p>
${D.deadlines.filter((d) => d.always_show).map(deadlineAlert).join('\n')}
      </div>
    </section>

    <section class="section section-muted" id="checker-section">
      <div class="wrap narrow">
        <div class="section-head">
          <p class="eyebrow">CHECKER</p>
          <h2>回る窓口を、1枚の順路表にします。</h2>
          <p>故人に当てはまるものを選ぶと、建物ごとにまとめた窓口・電話番号・持ち物の一覧を表示します。印刷して当日お持ちください。</p>
        </div>
        <div id="checker"></div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">MAP</p>
          <h2>いつ、何をするか。</h2>
          <p>時期ごとに分けると、いま考えなくてよいことが分かります。</p>
        </div>
        <div class="timeline">
${timeline.map((t) => `          <article class="tl-card">
            <span class="when">${esc(t.when)}</span>
            <h3>${esc(t.h)}</h3>
            <p>${esc(t.p)}</p>
            <ul>${t.li.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            ${anchor(t.link, 'text-link')}
          </article>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">BUILDINGS</p>
          <h2>窓口は5か所に分かれています。</h2>
          <p>ただし、すべてを回る必要はありません。支所や市民課でまとめて済ませられる手続きもあります。</p>
        </div>
        ${buildingMap()}
        <div class="window-table" style="margin-top:26px">
          <div class="row"><b>各支所でも手続きできるもの</b><div>${
            [...new Set(D.windows.filter((w) => w.alt && w.alt.includes('支所')).map((w) => w.name))]
              .map((n) => esc(n)).join('／')
          }<ul>${D.branch_offices.map((b) => `<li>${esc(b.name)}　${esc(b.tel)}</li>`).join('')}</ul></div></div>
        </div>
        <p class="small-note">くわしくは<a href="cityhall.html">市役所での手続き</a>のページにまとめています。市役所以外の手続きは<a href="outside.html">こちら</a>です。</p>
      </div>
    </section>`,
});

/* ================================================================== */
/* 2. cityhall.html — 市役所での手続き                                 */
/* ================================================================== */

/** 建物 → 窓口 → 手続き の一覧表 */
function cityhallTable() {
  return D.buildings.map((b) => {
    const rows = D.windows.filter((w) => w.building === b.id).map((w) => {
      const qs = D.questions.filter((x) => (x.windows || []).includes(w.id));
      const procs = qs.flatMap((x) => x.procedures.map((p) => p.name));
      return `<div class="row">
            <b>${esc(w.name)}</b>
            <div><span class="tel">${telLink(w.tel)}</span>
              <ul>${procs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
              ${w.alt ? `<p class="window-alt" style="margin-top:10px">${esc(w.alt)}</p>` : ''}
            </div>
          </div>`;
    }).join('\n');
    return `        <h3>${esc(b.name)}<span style="color:var(--muted);font-weight:400;font-size:.86rem;margin-left:10px">${esc(b.address)}</span></h3>
        <div class="window-table">
${rows}
        </div>`;
  }).join('\n');
}

const branchWindows = D.windows.filter((w) => w.alt && w.alt.includes('支所'));

page({
  file: 'cityhall.html',
  breadcrumb: '市役所での手続き',
  title: '磐田市役所での手続き一覧（窓口・電話・持ち物）｜磐田おくやみ窓口',
  description: '磐田市で家族を亡くされたあとの市役所の手続きを、本庁舎1階・iプラザ3階・西庁舎・福田支所の建物順に一覧にしました。窓口名・電話番号・持ち物、支所でできる手続き、戸籍や住民票の手数料までまとめています。',
  eyebrow: '市役所での手続き',
  h1: '磐田市役所で行う手続き',
  lead: '建物ごとに、窓口・電話番号・持ち物をまとめました。支所で済ませられる手続きも分けて載せています。',
  faq: [
    ['磐田市役所での手続きは、どの窓口へ行けばよいですか。', '故人が加入していた制度によって窓口が変わります。国民健康保険・後期高齢者医療・市税・資産税・印鑑登録は本庁舎1階、介護保険・高齢者福祉・障害福祉・こども関係はiプラザ3階、農地と霊園は西庁舎1階、市営住宅は西庁舎2階、水道は福田支所2階の上下水道料金センターです。'],
    ['支所でもできる手続きはありますか。', `はい。${branchWindows.map((w) => w.name).join('、')}に関する手続きは、福田・竜洋・豊田・豊岡の各支所でも受け付けています。iプラザまで行かなくても済む場合があります。`],
    ['戸籍謄本はどこで取れますか。手数料はいくらですか。', `磐田市役所市民課（本庁舎1階・${D.certificates.counter.tel}）で請求できます。戸籍全部事項証明（戸籍謄本）は${D.certificates.items[0].fee}、除籍謄本と改製原戸籍は750円、戸籍の附票は300円、住民票は300円です。直系血族であれば、本籍地が遠方でも磐田市役所市民課で戸籍・除籍証明書（謄本に限る）を請求できる広域交付の制度があります。`],
  ],
  body: `    <section class="section">
      <div class="wrap narrow">
        ${aioBlock('磐田市役所での手続きは、どの窓口へ何を持って行けばよい？', '磐田市の窓口は本庁舎1階・iプラザ3階・西庁舎1階・西庁舎2階・福田支所2階の5か所に分かれています。故人が加入していた制度によって回る窓口が変わりますが、国民健康保険・介護保険・障害者手帳などの返納は本庁舎1階の市民課窓口や各支所でも受け付けているため、実際に回る場所は思ったより少なくなることがあります。')}
        <p>市役所の手続きは、一日でまとめて済ませられることがほとんどです。ただし、故人が加入していた制度によって窓口が変わるため、行ってから「別の建物です」と案内されることがあります。先に建物ごとの一覧を見て、回る順番を決めておくと移動が減ります。</p>
        <p>持ち物としてよく求められるのは、返納する証書類、相続人代表者の預金通帳、認印（スタンプ印は不可）の3つです。通帳はゆうちょ銀行の場合、通帳そのものではなくコピーを求められる窓口があります。すべてをそろえてから行く必要はありません。足りないものがあれば、その場で次に何を持って来ればよいかを教えてもらえます。</p>
        <p>なお、どの窓口へ行くべきか分からないときは、まず本庁舎1階の市民課窓口グループ（${telLink(D.certificates.counter.tel)}）へお声かけください。返納が中心の手続きであれば、その場で受けてもらえることがあります。</p>
      </div>
    </section>

    <section class="section section-muted">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">WINDOWS</p>
          <h2>建物ごとの窓口一覧</h2>
          <p>市役所本庁舎1階から順に並べています。かっこ内は所在地です。</p>
        </div>
${cityhallTable()}
      </div>
    </section>

    <section class="section">
      <div class="wrap narrow">
        <h2>支所でできる手続き一覧</h2>
        <p>おくやみの手続きというと市役所へ行くものと思われがちですが、返納が中心の手続きは各支所でも受け付けています。iプラザ3階まで行かなくても、お近くの支所で済むことがあります。ご高齢の方が手続きに行かれる場合や、市役所から遠い地域にお住まいの場合は、先に支所へ電話でご確認ください。</p>
        <div class="window-table">
${branchWindows.map((w) => {
    const qs = D.questions.filter((x) => (x.windows || []).includes(w.id));
    return `          <div class="row"><b>${esc(w.name)}</b><div>${telLink(w.tel)}
            <ul>${qs.flatMap((x) => x.procedures.map((p) => `<li>${esc(p.name)}</li>`)).join('')}</ul>
            <p class="window-alt" style="margin-top:10px">${esc(w.alt)}</p></div></div>`;
  }).join('\n')}
        </div>
        <h3>各支所の連絡先</h3>
        <div class="window-table">
${D.branch_offices.map((b) => `          <div class="row"><b>${esc(b.name)}</b><div>${esc(b.tel)}</div></div>`).join('\n')}
        </div>
        <p class="small-note">支所ごとに担当が分かれている場合があります。上の番号のうち、市民担当は保険証・住民票など、福祉担当は介護保険・障害福祉などの窓口です。</p>
      </div>
    </section>

    <section class="section section-soft">
      <div class="wrap narrow">
        <h2>${esc(D.certificates.title)}</h2>
        <p>${esc(D.certificates.intro)}</p>
        <div class="window-table">
${D.certificates.items.map((c) => `          <div class="row"><b>${esc(c.name)}</b><div><span class="tel">${esc(c.fee)}</span><ul><li>${esc(c.who)}</li></ul></div></div>`).join('\n')}
        </div>
        <aside class="note-box">
          <h3>戸籍の広域交付</h3>
          <p>${esc(D.certificates.kouiki)}</p>
        </aside>
        <p>証明書は何通必要になるか読みにくいものです。金融機関や年金の手続きでは原本の提出を求められることがある一方、コピーで足りる場合もあります。最初から多めに取るより、まず数通取って、足りなければ追加する方が無駄がありません。相続登記まで進む場合は、必要な範囲を司法書士に確認してから請求すると確実です。</p>
        <p>請求先は${esc(D.certificates.counter.name)}（${telLink(D.certificates.counter.tel)}）です。</p>
      </div>
    </section>`,
});

/* ================================================================== */
/* 3. outside.html — 市役所以外の手続き                                */
/* ================================================================== */

const EX = D.external_always_show.items;
const featured = ['ext_nenkin', 'ext_zeimusho', 'ext_houmukyoku'];
const rest = EX.filter((e) => !featured.includes(e.id));

const featuredProse = {
  ext_nenkin: '故人が年金を受け取っていた場合、または加入中だった場合の手続きです。受け取っていた年金の種類（老齢基礎年金・老齢厚生年金・遺族年金・障害年金など）によって、必要な書類も届出の期限も変わります。マイナンバーが日本年金機構に収録されている方は、死亡の届出そのものを省略できる場合があります。ただし、故人が受け取るはずだった分の年金（未支給年金）の請求は別に必要です。まずは電話で、故人の状況を伝えて必要書類を確認するのが確実です。期限については<a href="deadline.html">期限のある手続き</a>のページにまとめています。',
  ext_zeimusho: '相続税は、遺産の総額が基礎控除額を超える場合に申告が必要になります。土地や家屋が含まれると評価に時間がかかるため、早めに全体像をつかんでおくと安心です。また、故人に事業収入や不動産収入、一定額以上の年金収入があった場合は、亡くなった年の所得について準確定申告が必要になることがあります。どちらも対象になるかどうかの判断が難しいため、税務署または税理士へご確認ください。',
  ext_houmukyoku: '土地や家屋を相続した場合の名義変更（相続登記）は、令和6年4月から義務化されました。手続きそのものは司法書士に依頼することもできます。相続人が多い場合や、何代も前の名義のままになっている場合は、必要な戸籍の量が多くなり、ご自身で進めるのは負担が大きくなります。義務化の内容と期限については<a href="touki.html">相続登記の義務化</a>のページで詳しく説明しています。',
};

function extCard(e, level = 'h3') {
  return `        <${level}>${esc(e.label)}</${level}>
        <div class="window-table">
          <div class="row"><b>${esc(e.contact)}</b><div>${e.tel ? `<span class="tel">${telLink(e.tel)}</span>` : ''}${e.note ? `<ul><li>${esc(e.note)}</li></ul>` : ''}</div></div>
        </div>`;
}

page({
  file: 'outside.html',
  breadcrumb: '市役所以外の手続き',
  title: '市役所以外で必要な手続き（年金・税務署・法務局ほか）｜磐田おくやみ窓口',
  description: '磐田市で家族を亡くされたあと、市役所以外で必要になる手続きを整理しました。浜松東年金事務所、磐田税務署、静岡地方法務局磐田出張所、自動車、免許証、金融機関などの連絡先と注意点をまとめています。',
  eyebrow: '市役所以外の手続き',
  h1: '市役所以外で必要な手続き',
  lead: '年金、税務署、法務局、自動車、免許証、金融機関など。市役所の窓口では受け付けていないものをまとめました。',
  faq: [
    ['市役所以外で必要な手続きには何がありますか。', `年金（${ext('ext_nenkin').contact} ${ext('ext_nenkin').tel}）、相続税や準確定申告（${ext('ext_zeimusho').contact} ${ext('ext_zeimusho').tel}）、相続登記（${ext('ext_houmukyoku').contact} ${ext('ext_houmukyoku').tel}）、軽自動車や普通自動車の名義変更、運転免許証の返納、金融機関や生命保険、電気・ガス・電話・NHKなどの契約の手続きがあります。`],
    ['原付と軽自動車では手続き先が違いますか。', `違います。原付（125cc以下）・小型特殊自動車・ミニカーは磐田市役所本庁舎1階の${win('w_shozei').name}（${win('w_shozei').tel}）ですが、軽自動車（三輪・四輪）は${ext('ext_kei').contact}、125cc超のバイクは${ext('ext_unyu').contact}、普通自動車は${ext('ext_zaimu').contact}と、それぞれ別の窓口になります。`],
  ],
  body: `    <section class="section">
      <div class="wrap narrow">
        ${aioBlock('磐田市で家族が亡くなった。市役所のほかにどこで手続きが必要？', `市役所以外では、年金（${ext('ext_nenkin').contact}）、相続税や準確定申告（${ext('ext_zeimusho').contact}）、相続登記（${ext('ext_houmukyoku').contact}）、自動車の名義変更、運転免許証の返納、金融機関・生命保険・電気・ガス・電話・NHKなどの契約の手続きが必要になります。加入先や契約先ごとに窓口が違うため、通帳の引き落とし履歴や郵便物から契約先を洗い出しておくと漏れが減ります。`)}
        <p>市役所の手続きが終わっても、それで全部ではありません。年金、税金、登記、自動車、そして民間の契約は、それぞれ別の窓口で手続きします。件数としてはこちらの方が多くなることも珍しくありません。</p>
        <p>すべてを思い出そうとすると必ず抜けが出ます。おすすめは、故人の預金通帳の引き落とし履歴と、届いている郵便物を並べて見ることです。毎月・毎年の引き落としがあるものは、どこかに契約が残っています。保険証券や車検証、権利証といった書類は、まとめて一か所に集めておくと、その後の手続きが一度で済みます。</p>
      </div>
    </section>

    <section class="section section-muted">
      <div class="wrap narrow">
        <h2>年金の手続き</h2>
        <p>${featuredProse.ext_nenkin}</p>
${extCard(ext('ext_nenkin'), 'h3')}

        <h2>税務署の手続き</h2>
        <p>${featuredProse.ext_zeimusho}</p>
${extCard(ext('ext_zeimusho'), 'h3')}

        <h2>法務局の手続き（相続登記）</h2>
        <p>${featuredProse.ext_houmukyoku}</p>
${extCard(ext('ext_houmukyoku'), 'h3')}
      </div>
    </section>

    <section class="section">
      <div class="wrap narrow">
        <h2>そのほかの手続き</h2>
        <p>自動車は種類によって窓口が完全に分かれます。原付（125cc以下）・小型特殊自動車・ミニカーだけは市役所（本庁舎1階の${esc(win('w_shozei').name)}）ですが、それ以外はすべて市役所以外です。車検証を見て、種類を確認してから電話するとやりとりが早く済みます。</p>
        <ul class="external-list">
${rest.map((e) => `          <li><b>${esc(e.label)}</b><span class="contact">${esc(e.contact)}${e.tel ? `　${telLink(e.tel)}` : ''}</span>${e.note ? `<span class="note">${esc(e.note)}</span>` : ''}</li>`).join('\n')}
        </ul>
        <aside class="note-box">
          <h3>金融機関の口座について</h3>
          <p>金融機関に死亡の連絡をすると、その口座は原則として凍結されます。公共料金や家賃の引き落としに使っていた口座であれば、先に引き落とし先の変更を済ませてから連絡すると、行き違いが起きにくくなります。ただし、凍結を避けるために引き出しを続けると、あとで相続の話し合いがこじれる原因になることがあります。判断に迷う場合は、金融機関の相続担当窓口に事情を伝えてご相談ください。</p>
        </aside>
      </div>
    </section>`,
});

/* ================================================================== */
/* 4. deadline.html — 期限のある手続き                                 */
/* ================================================================== */

// 磐田市の児童手当（15日以内）を国の期限一覧に混ぜて時系列で並べる
const jidou = D.deadlines.find((d) => d.id === 'dl_jidouteate');
const merged = [
  ND.items.find((x) => x.id === 'nd_shibou_todoke'),
  ND.items.find((x) => x.id === 'nd_kousei_nenkin'),
  {
    id: 'dl_jidouteate',
    label: jidou.label,
    limit: jidou.limit,
    start: '死亡日の翌日から起算',
    who: '新しく受給者になる方',
    body: `磐田市の手続きです。窓口はiプラザ3階の${q('q09_kodomo').windows.map((w) => win(w).name).join('・')}（${win('w_kodomo').tel}）。新しい受給者の健康保険情報が分かるものと、新しい受給者名義の通帳をお持ちください。`,
    authority: '磐田市',
    source_url: D.meta.source.page_url,
  },
  ND.items.find((x) => x.id === 'nd_kokumin_nenkin'),
  ND.items.find((x) => x.id === 'nd_souzoku_houki'),
  ND.items.find((x) => x.id === 'nd_junkakutei'),
  ND.items.find((x) => x.id === 'nd_souzokuzei'),
  ND.items.find((x) => x.id === 'nd_souzoku_touki'),
];

page({
  file: 'deadline.html',
  breadcrumb: '期限のある手続き',
  title: '死亡後の手続きで期限があるもの一覧（7日・10日・14日・3か月・10か月・3年）｜磐田おくやみ窓口',
  description: '磐田市で家族を亡くされたあとの手続きのうち、期限が決まっているものだけを時系列でまとめました。死亡届7日、年金の届出10日・14日、相続放棄3か月、準確定申告4か月、相続税10か月、相続登記3年。すべて一次資料で確認しています。',
  eyebrow: '期限のある手続き',
  h1: '期限が決まっている手続き',
  lead: '期限があるのは、実はごく一部です。まずこれだけ押さえておけば、あとは落ち着いてからで間に合います。',
  faq: [
    ['死亡後の手続きで期限があるものは何ですか。', '死亡届が7日以内、厚生年金の受給権者死亡届が10日以内、国民年金の受給権者死亡届と児童手当の受給者変更が14日以内、相続放棄・限定承認が3か月以内、準確定申告が4か月以内、相続税の申告・納付が10か月以内、相続登記が3年以内です。'],
    ['相続放棄はいつまでにすればよいですか。', '自己のために相続の開始があったことを知ったときから3か月以内に、家庭裁判所へ申述します。死亡日からではなく「相続の開始を知ったとき」から数えます。財産の全体像がつかめず3か月では判断できない場合は、家庭裁判所へ期間の伸長を申し立てられる制度があります。'],
    ['相続登記の期限はいつまでですか。', '相続の開始を知り、かつその不動産の所有権を取得したことを知った日から3年以内です。令和6年4月1日より前に開始した相続も対象で、その場合は令和9年3月31日までが期限です。正当な理由なく怠ると10万円以下の過料の対象になります。'],
  ],
  body: `    <section class="section">
      <div class="wrap narrow">
        ${aioBlock('磐田市で家族が亡くなった。期限が決まっている手続きはどれ？', '死亡届が亡くなられたことを知った日から7日以内、厚生年金の受給権者死亡届が死亡日から10日以内、国民年金の受給権者死亡届と児童手当の受給者変更が14日以内、相続放棄・限定承認が3か月以内、準確定申告が4か月以内、相続税の申告・納付が10か月以内、相続登記が3年以内です。それ以外の市役所の手続きに一律の期限はありません。')}
        <p>手続きの案内を見ると、たくさんの項目が並んでいて、すべてを急がなければいけないように感じます。けれど実際に期限が決まっているものは、この8つだけです。それ以外は、落ち着いてからで構いません。</p>
        <p>とくに気をつけていただきたいのは、期限の起算日が「死亡日」ではないものがあることです。相続放棄と相続登記は「知った日」から数えます。遠方に住むご親族が、あとから相続人だと分かった場合などは、そこから期間が始まります。</p>
      </div>
    </section>

    <section class="section section-muted">
      <div class="wrap narrow">
        <div class="section-head">
          <p class="eyebrow">DEADLINES</p>
          <h2>期限の早い順</h2>
        </div>
${merged.map((d) => `        <div class="deadline-alert">
          <h3>${esc(d.label)}</h3>
          <p class="limit">${esc(d.limit)}</p>
          ${d.start ? `<p><b>起算日</b>：${esc(d.start)}</p>` : ''}
          <p>${d.body}</p>
          <p style="margin-top:8px;font-size:.86rem">出典：${esc(d.authority)}　<a href="${esc(d.source_url)}" target="_blank" rel="noopener">一次資料を見る</a></p>
        </div>`).join('\n')}
      </div>
    </section>

    <section class="section">
      <div class="wrap narrow">
${ND.supplements.map((s) => `        <h2>${esc(s.label)}</h2>
        <p>${esc(s.body)}</p>
        <p style="font-size:.86rem;color:var(--muted)">出典：${esc(s.authority)}　<a href="${esc(s.source_url)}" target="_blank" rel="noopener">一次資料を見る</a></p>`).join('\n')}

        <aside class="note-box">
          <h3>期限がない手続きについて</h3>
          <p>保険証や介護保険被保険者証の返納、印鑑登録証やマイナンバーカードの返納、水道や市税の口座振替の停止などには、一律の期限は定められていません。ただし口座振替は、故人名義の口座からの引き落としができなくなるため、早めに手続きしておくと納付書の行き違いが起きません。印鑑登録証とマイナンバーカードについては、返納の義務そのものがありません。相続の手続きが終わるまで必要になる場面があるため、すべて終わってから返納・破棄することをおすすめします。</p>
        </aside>
        <p class="small-note">期限のある手続きのうち、相続放棄・準確定申告・相続税・相続登記は、市役所の窓口では扱っていません。それぞれ家庭裁判所、税務署、法務局が窓口です。<a href="outside.html">市役所以外の手続き</a>もあわせてご確認ください。</p>
      </div>
    </section>`,
});

/* ================================================================== */
/* 5. touki.html — 相続登記の義務化                                    */
/* ================================================================== */

const HK = ext('ext_houmukyoku');
const TOUKI = ND.items.find((x) => x.id === 'nd_souzoku_touki');

page({
  file: 'touki.html',
  breadcrumb: '相続登記の義務化',
  title: '相続登記の義務化（令和6年4月〜）と磐田市の窓口｜磐田おくやみ窓口',
  description: '令和6年4月から義務化された相続登記について、期限・過料・相続人申告登記・静岡地方法務局磐田出張所の連絡先を整理しました。司法書士に頼む範囲と、その前に自分で整理できる範囲も分けて説明します。',
  eyebrow: '相続登記の義務化',
  h1: '相続登記は、令和6年4月から義務になりました',
  lead: '期限は3年。ただし、あわてて動く前に整理しておくと、手続きが一度で済みます。',
  faq: [
    ['相続登記はいつまでにしなければいけませんか。', `${TOUKI.limit}です。令和6年4月1日より前に開始した相続も対象で、その場合は令和9年3月31日までが期限です。正当な理由なく怠ると10万円以下の過料の対象になります。`],
    ['磐田市で相続登記をする窓口はどこですか。', `${HK.contact}（${HK.tel}）です。${HK.note}。`],
    ['遺産分割の話し合いがまとまらない場合はどうすればよいですか。', '「相続人申告登記」という制度があります。自分が相続人であることを法務局へ申し出ることで、期限内に義務を果たしたものとして扱われます。ただしこれは名義変更そのものではないため、話し合いがまとまった段階で改めて相続登記が必要です。'],
  ],
  body: `    <section class="section">
      <div class="wrap narrow">
        ${aioBlock('磐田市で相続した家や土地の名義変更（相続登記）はいつまでに、どこでする？', `${TOUKI.limit}です。令和6年4月1日より前に開始した相続も対象で、その場合の期限は令和9年3月31日までです。正当な理由なく怠ると10万円以下の過料の対象になります。磐田市の場合の窓口は${HK.contact}（${HK.tel}）で、手続きは司法書士に依頼することもできます。`)}
        <p>おくやみの手続きが一段落したあと、多くの方が最後に残すのが不動産の名義です。これまでは「そのうちやればいい」で済んでいましたが、令和6年4月から相続登記は法律上の義務になりました。</p>
        <p>とはいえ、いますぐ法務局へ行く必要はありません。期限は3年あります。むしろ、必要な書類も相続人の範囲も分からないまま動くと、何度も足を運ぶことになります。先に整理しておいた方が、結果的に早く終わります。</p>

        <h2>期限と、過料のこと</h2>
        <div class="deadline-alert">
          <h3>${esc(TOUKI.label)}</h3>
          <p class="limit">${esc(TOUKI.limit)}</p>
          <p><b>起算日</b>：${esc(TOUKI.start)}</p>
          <p>${esc(TOUKI.body)}</p>
          <p style="margin-top:8px;font-size:.86rem">出典：${esc(TOUKI.authority)}　<a href="${esc(TOUKI.source_url)}" target="_blank" rel="noopener">一次資料を見る</a></p>
        </div>
        <p>過料という言葉に驚かれるかもしれませんが、期限を1日過ぎたら直ちに科されるというものではありません。「正当な理由」があると認められる場合は対象外です。相続人が極めて多く戸籍の収集に時間がかかる、相続人の間で争いがあって不動産の帰属が決まらない、といった事情がこれにあたります。大切なのは、放置せずに何らかの形で動いておくことです。</p>

        <h2>話し合いがまとまらないときの選択肢</h2>
        <p>誰が相続するか決まらないまま3年が過ぎそうなときは、「相続人申告登記」という制度があります。自分が相続人であることを法務局に申し出るだけで、その人については期限内に義務を果たしたものとして扱われます。必要な書類も、通常の相続登記より少なくて済みます。</p>
        <p>ただし、これは名義変更そのものではありません。この状態のままでは家や土地を売ることも、担保に入れることもできません。話し合いがまとまった段階で、改めて相続登記が必要になります。時間を稼ぐための制度だとお考えください。</p>

        <h2>司法書士に頼む範囲と、その前にできること</h2>
        <p>相続登記の申請そのものは、司法書士の領域です。当社は不動産会社ですので、登記申請を代理することはできませんし、必要な戸籍の範囲や登記の可否を判断することもできません。そこは必ず司法書士へご相談ください。</p>
        <p>一方で、司法書士に相談する前の段階には、不動産会社の方が調べやすいことがあります。たとえば、固定資産税の課税明細に載っている土地建物が実際にいくつあるのか、課税されていない私道が含まれていないか、登記されていない建物がないか、農地や山林が混ざっていないか、境界や接道はどうなっているか。こうした「現況の整理」が済んでいると、司法書士との打ち合わせが一度で終わります。</p>
        <p>${esc(CTA.inline_touki.text)}<a href="/karte/">売却前カルテについて見る</a>。</p>

        <h2>磐田市の窓口</h2>
        <div class="window-table">
          <div class="row"><b>${esc(HK.contact)}</b><div><span class="tel">${telLink(HK.tel)}</span><ul><li>${esc(HK.note)}</li><li>${esc(HK.label)}</li></ul></div></div>
        </div>
        <p class="small-note">農地・山林を相続した場合は、相続登記が終わったあとに市役所西庁舎1階の${esc(win('w_norin').name)}（${telLink(win('w_norin').tel)}）へ届出が必要です。${esc(q('q10_nouchi').note)}くわしくは<a href="fudosan.html">不動産が絡むおくやみ手続き</a>をご覧ください。</p>
      </div>
    </section>
`,
});

/* ================================================================== */
/* 6. fudosan.html — 不動産が絡むおくやみ手続き                        */
/* ================================================================== */

const F_ITEMS = [
  { q: 'q05_tochi_kaoku', h: '土地・家屋を持っていた場合', p: '磐田市内に土地や家屋があると、固定資産税の納税義務者を誰にするかを市へ届け出ることになります。これは相続登記とは別の手続きで、登記が終わっていなくても必要です。相続登記が済むまでの間、市は「相続人代表者」として届け出られた方へ納税通知書を送ります。届出をしないと、亡くなった方の名義のまま通知書が届き続けることになります。' },
  { q: 'q05_tochi_kaoku', h: '登記していない家屋がある場合', p: '古い納屋、増築した部分、建て替え前の離れなど、登記されていない建物は珍しくありません。固定資産税は課税されているのに登記がない、という状態です。この場合は上と同じ資産税課へ「未登記家屋異動届出書」を提出します。売却や解体を考えるときにここでつまずくことが多いため、心当たりがあれば早い段階で確認しておくと安心です。', noTable: true },
  { q: 'q10_nouchi', h: '農地・山林を持っていた場合', p: '農地や山林は、宅地と同じようには扱えません。相続したこと自体を農業委員会へ届け出る必要があり、その届出は相続登記が終わってからになります。また、農業者年金に加入していた場合は、農協へ提出する死亡関係届出書を市で発行してもらいます。農地は売却や転用にも制限があるため、まず現況と地目を確認することから始めてください。' },
  { q: 'q06_shizei', h: '固定資産税の口座振替があった場合', p: '故人名義の口座からの引き落としはできなくなります。手続きをしないままだと、納期限が過ぎて延滞金が発生することがあります。口座振替を止めると納付書が送られてきますので、まずはそれで納めていただき、名義が決まった段階で改めて振替の手続きをするのが一般的な流れです。' },
  { q: 'q11_shiei_jutaku', h: '市営住宅に住んでいた場合', p: '入居者が亡くなられた場合は、引き続き住むための入居者変更の届出か、退去の手続きが必要になります。退去では、家財の搬出と原状回復が求められます。長く住まわれた部屋では荷物の量が想像以上になることが多く、期限までに片づけが終わらないというご相談をよくいただきます。早めに全体量を見ておくと、段取りが立てやすくなります。' },
];

page({
  file: 'fudosan.html',
  breadcrumb: '不動産が絡む手続き',
  title: '不動産が絡むおくやみ手続き（土地・家屋・未登記・農地・市営住宅）｜磐田おくやみ窓口',
  description: '磐田市で家族を亡くされたあと、土地・家屋・未登記家屋・農地・山林・固定資産税・市営住宅の退去など、不動産が関わる手続きをまとめました。窓口・持ち物と、あとで困りやすい点を整理しています。',
  eyebrow: '不動産が絡む手続き',
  h1: '不動産が絡むおくやみ手続き',
  lead: '土地・家屋、登記していない建物、農地や山林、固定資産税、市営住宅の退去。あとから困りやすいところをまとめました。',
  faq: [
    ['磐田市内の土地や家屋を相続したとき、市役所で何をしますか。', `本庁舎1階の${win('w_shisanzei').name}（${win('w_shisanzei').tel}）へ、相続人代表（現所有者）の届出をします。登記していない家屋がある場合は、あわせて未登記家屋異動届出書を提出します。これは法務局での相続登記とは別の手続きです。`],
    ['農地や山林を相続した場合はどうすればよいですか。', `西庁舎1階の${win('w_norin').name}（${win('w_norin').tel}）へ、土地の相続等についての届出をします。${q('q10_nouchi').note}届出には相続登記がわかる書類、届出人の本人確認書類、届出人の認印が必要です。`],
    ['登記されていない建物があるようです。どうなりますか。', '固定資産税は課税されているのに登記がない建物は珍しくありません。この場合は資産税課へ未登記家屋異動届出書を提出します。売却や解体を考える段階でつまずきやすい点なので、早めに確認しておくことをおすすめします。'],
  ],
  body: `    <section class="section">
      <div class="wrap narrow">
        ${aioBlock('磐田市で相続した家・土地・農地について、市役所でどんな手続きがある？', `磐田市内に土地や家屋があれば本庁舎1階の${win('w_shisanzei').name}（${win('w_shisanzei').tel}）へ相続人代表者の届出を、登記していない家屋があれば未登記家屋異動届出書を提出します。農地・山林は西庁舎1階の${win('w_norin').name}（${win('w_norin').tel}）へ、相続登記が終わったあとに届出をします。これらは法務局での相続登記とは別の手続きです。`)}
        <p>不動産が関わる手続きは、ほかのおくやみ手続きと少し性格が違います。返納して終わりではなく、そのあとに「どうするか」を決める必要が出てくるからです。そして多くの場合、決めるための材料がそろっていません。</p>
        <p>この段階で全部を決める必要はありません。ただ、市役所へ行ったついでに確認しておくと、あとで探し直さずに済むことがあります。以下、手続きごとに整理しました。</p>

${F_ITEMS.map((it) => {
    const qq = q(it.q);
    const w = win(qq.windows[0]);
    if (it.noTable) {
      return `        <h2>${esc(it.h)}</h2>
        <p>${esc(it.p)}</p>`;
    }
    return `        <h2>${esc(it.h)}</h2>
        <p>${esc(it.p)}</p>
        <div class="window-table">
          <div class="row"><b>${esc(w.name)}</b><div><span class="tel">${telLink(w.tel)}</span>
            <ul>${qq.procedures.map((p) => `<li>${esc(p.name)}${p.items && p.items[0] && !p.items[0].startsWith('詳細は') ? `<br><span style="font-size:.9em">持ち物：${p.items.map(esc).join('／')}</span>` : ''}</li>`).join('')}</ul>
            <span style="font-size:.88rem;color:var(--muted)">${esc(bld(w.building).name)}</span></div></div>
        </div>`;
  }).join('\n\n')}

        <h2>あとで効いてくる、いまできる整理</h2>
        <p>ここまでの手続きは、いずれも「市に届け出る」ところまでです。その先、相続した家や土地をどうするかは、家族で話し合って決めることになります。売る、貸す、住む、そのまま持ち続ける。どれを選ぶにしても、判断の前に現況が分かっていないと話が進みません。</p>
        <p>実際にご相談をいただくと、課税明細に載っていない私道があった、隣地との境界が確定していなかった、接道が2メートルに足りなかった、農地のつもりが地目は宅地だった、といったことが後から分かる例が少なくありません。これらは売る段階で初めて表面化すると、そこから数か月止まります。</p>
        <p>${esc(CTA.inline_touki.text)}<a href="/karte/">売却前カルテについて見る</a>。</p>

        <h2>関連する読み物</h2>
        <div class="card-grid">
          <article class="card compact"><h3>固定資産税通知書から整理する</h3><p>通知書を入口に、土地建物の範囲と維持費を見える化します。</p><a href="${esc(CTA.soft_tax.link.url)}">読む</a></article>
          <article class="card compact"><h3>農地や畑も含まれている</h3><p>宅地以外の土地があるとき、通常の売却と何が違うのかを整理します。</p><a href="/souzoku/articles/farmland-inherited-property.html">読む</a></article>
          <article class="card compact"><h3>相続登記がまだの段階での相談</h3><p>名義が決まる前でも、何を相談できるのかをまとめています。</p><a href="/souzoku/articles/inheritance-registration-before-consultation.html">読む</a></article>
        </div>
      </div>
    </section>
`,
});

console.log('完了しました。');
