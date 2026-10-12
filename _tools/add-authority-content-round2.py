#!/usr/bin/env python3
"""2026-10-12 第2弾（冪等・マーカー付き）。

  A. karte/assets/atawi.css に .table-wrap の表スタイル（ガイド記事の判断表に罫線を付ける）
  B. 残りの /guide/ 11本に「判断基準の表」と制度の数字（相続した実家向け／自宅向けの2種）
  C. /areas/hamamatsu /kakegawa /mori に「市町の窓口・制度」セクション（公式リンクつき）

使い方: python -X utf8 _tools/add-authority-content-round2.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DRY = "--dry-run" in sys.argv
MARK = "<!-- authority-20261012 -->"
MARK2 = "<!-- authority-20261012-r2 -->"
changed = []


def rd(p):
    return open(os.path.join(ROOT, p), "rb").read().decode("utf-8")


def wr(p, s):
    changed.append(p)
    if not DRY:
        open(os.path.join(ROOT, p), "wb").write(s.encode("utf-8"))


def insert_before(s, anchor, block, rel):
    i = s.find(anchor)
    if i < 0:
        print("anchor not found:", rel, anchor[:40])
        return None
    return s[:i] + block + ("\r\n" if "\r\n" in s else "\n") + s[i:]


# ---------------------------------------------------------------- A. CSS
CSS = """
/* 2026-10-12: ガイド記事の判断基準の表 */
.table-wrap{margin:20px 0 8px;overflow-x:auto;border:1px solid #cde2f0;border-radius:12px;background:#fff}
.table-wrap table{width:100%;min-width:640px;border-collapse:collapse;font-size:14.5px}
.table-wrap th,.table-wrap td{padding:12px 14px;border-bottom:1px solid #e3edf5;text-align:left;vertical-align:top;line-height:1.7}
.table-wrap thead th{background:#e9f5fc;color:#1f4e79;font-weight:700}
.table-wrap tbody th{background:#f6fafd;font-weight:700;white-space:nowrap}
.table-wrap tr:last-child th,.table-wrap tr:last-child td{border-bottom:0}
"""
rel = "karte/assets/atawi.css"
s = rd(rel)
if ".table-wrap table" not in s:
    wr(rel, s.rstrip("\r\n") + "\n" + CSS)

# ---------------------------------------------------------------- B. guides
ROWS_INHERIT = [
    ("将来、誰かが住む・使う予定", "ある（Uターン、親族が使う、戻る可能性を残す）", "当面ない。建物を傷ませずに持ち続けたい", "ない。家族の誰も使う見込みがない"),
    ("年間の負担", "固定資産税・保険・通水・草刈り・見回りを自分たちで払い続けられる", "家賃収入で税・修繕費をまかなえる見込みがある", "負担そのものをなくしたい"),
    ("現地へ通えるか", "通える、または管理サービスに委託できる", "管理会社に任せられる", "通えない。遠方からの対応が精神的に負担"),
    ("建物の状態", "今のまま使える", "貸せる状態に直す費用を出せる", "修繕・解体の判断を買主に委ねたい"),
    ("税の期限", "急いで現金化する必要がない", "貸すと空き家の3,000万円特別控除は使えなくなる", "相続から3年目の年末までに売れば特例の対象になりうる"),
]
ROWS_OWN = [
    ("住み替え先の資金", "今の家に住み続ける。住み替え資金は別に用意できる", "家賃で住み替え先の費用の一部をまかなう", "売却代金を住み替え先の資金に充てる"),
    ("将来、戻る・家族が使う可能性", "ある", "ある。定期借家で期間を区切る", "ない"),
    ("年間の負担", "固定資産税・修繕・保険を払い続けられる", "家賃収入で税・修繕費をまかなえる", "負担そのものをなくしたい"),
    ("建物の状態", "今のまま住める", "貸せる状態に直す費用を出せる", "修繕の判断を買主に委ねたい"),
    ("税の期限", "急がない", "貸し始めると居住用財産の特例は使えなくなる", "住まなくなった日から3年目の年末までに売れば3,000万円特別控除の対象になりうる"),
]

NUMBERS_INHERIT = """<h3>数字で確認しておくこと</h3><ul>
<li><strong>固定資産税の住宅用地特例</strong>：住宅が建っている土地は、200㎡以下の部分の課税標準が6分の1（200㎡を超える部分は3分の1）に軽減されています。建物を解体して更地にすると特例が外れ、土地の税額が最大で約6倍になります。管理不全空家等・特定空家等として市から<strong>勧告</strong>を受けた場合も、建物が残っていても特例の対象から外れます。{{NOTE}}</li>
<li><strong>空き家の3,000万円特別控除（被相続人の居住用財産）</strong>：相続した家を売るとき、譲渡所得から最高3,000万円を控除できる制度です。期限は<strong>相続開始の日から3年を経過する日の属する年の12月31日まで</strong>で、2027年12月31日までの売却が対象です。昭和56年5月31日以前に建てられた家で、亡くなった方が一人で住んでいたこと、売却額が1億円以下であることなどの要件があり、貸した家は対象外になります。相続人が3人以上の場合は控除額が2,000万円になります（<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3306.htm" rel="noopener">国税庁 No.3306</a>）。</li>
<li><strong>相続登記の義務化</strong>：2024年4月1日から、相続で不動産を取得したことを知った日から<strong>3年以内</strong>の登記申請が義務です。正当な理由なく怠ると10万円以下の過料の対象になります（<a href="https://www.moj.go.jp/MINJI/minji05_00435.html" rel="noopener">法務省</a>）。売る・貸すのどちらを選んでも、名義が亡くなった方のままでは契約に進めません。</li>
</ul><p class="fine">税額・控除の可否は土地ごと・家族ごとに異なります。金額の確定は市の資産税窓口と税理士に、登記は司法書士にご確認ください。実家カルテでは、これらの要件に関係する「建築年」「名義」「相続開始日」「接道」を先に整理します。</p>"""

NUMBERS_OWN = """<h3>数字で確認しておくこと</h3><ul>
<li><strong>居住用財産の3,000万円特別控除</strong>：自分が住んでいた家を売るとき、譲渡所得から最高3,000万円を控除できます。住まなくなった後に売る場合は、<strong>住まなくなった日から3年を経過する日の属する年の12月31日まで</strong>に売ることが要件で、その間に貸すと対象外になります（<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3302.htm" rel="noopener">国税庁 No.3302</a>）。</li>
<li><strong>所有期間で変わる税率</strong>：売った年の1月1日時点で所有期間が5年を超えていれば長期譲渡所得として税率20.315%、5年以下なら39.63%（所得税・復興特別所得税・住民税の合計）。10年を超える自宅は、3,000万円控除後の6,000万円以下の部分に軽減税率14.21%が使えます（<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3305.htm" rel="noopener">国税庁 No.3305</a>）。{{NOTE}}</li>
<li><strong>固定資産税の住宅用地特例</strong>：住宅が建っている土地は、200㎡以下の部分の課税標準が6分の1（200㎡を超える部分は3分の1）に軽減されています。住み替え後に空き家のまま管理が行き届かず、市から<strong>勧告</strong>を受けると特例が外れ、土地の税額が最大で約6倍になります。解体して更地にした場合も同じです。</li>
</ul><p class="fine">税額・控除の可否は家ごと・家族ごとに異なります。金額の確定は税理士に、住み替え先との資金計画は売却の前にご確認ください。実家カルテでは、これらに関係する「取得時期」「建築年」「名義」「接道」を先に整理します。</p>"""


def block(rows, numbers, note):
    head = "<thead><tr><th>判断のポイント</th><th>残す（管理する）</th><th>貸す</th><th>売る</th></tr></thead>"
    body = "".join(f"<tr><th>{a}</th><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in rows)
    return (MARK + f'<h2>判断基準の表：残す・貸す・売るを同じ軸で比べる</h2><div class="table-wrap"><table>{head}<tbody>{body}</tbody></table></div>'
            + numbers.replace("{{NOTE}}", note))


GUIDES = {
    "guide/before-inheritance-registration/index.html": ("inherit", "相続登記が終わっていない家でも、特例の期限は相続開始日から数え始めています。登記の完了を待つ間も期限は進みます。"),
    "guide/before-selling-family-home/index.html": ("inherit", "売る前の14項目の確認は、この特例の要件（建築年・一人暮らし・1億円以下）の確認を兼ねます。"),
    "guide/family-disagreement-home/index.html": ("inherit", "共有名義のまま売る場合は、共有者全員が各自の持分について控除を受けられます。意見が分かれている間も期限は進みます。"),
    "guide/family-home-first-check/index.html": ("inherit", "親御さんがご存命で施設などに入居している場合は、相続ではなく本人の売却になるため、適用される特例が変わります。"),
    "guide/house-with-belongings/index.html": ("inherit", "荷物の片付けに時間がかかる家ほど、特例の期限と片付けの予定を同じカレンダーで管理してください。"),
    "guide/inherited-family-home/index.html": ("inherit", ""),
    "guide/old-house-first-check/index.html": ("inherit", "昭和56年5月31日以前の建物は、空き家特例の対象になりうる一方、売却前に耐震基準を満たすか取り壊すかの判断が必要です（2024年以降は買主が翌年2月15日までに行う方式も可）。"),
    "guide/vacant-house-first-check/index.html": ("inherit", "しばらく使っていない家は、特例の「相続開始直前まで被相続人が住んでいた」要件を満たすか、住民票と実態の両方で確認します。"),
    "guide/before-selling-own-home/index.html": ("own", ""),
    "guide/own-home-future/index.html": ("own", "決めるのを先に延ばす場合も、住まなくなってからの3年の期限だけは把握しておいてください。"),
    "guide/senior-relocation/index.html": ("own", "施設や高齢者住宅へ移った後に自宅を売る場合も、この3年の期限が起点になります。"),
}
for rel, (kind, note) in GUIDES.items():
    s = rd(rel)
    if MARK in s:
        continue
    b = block(ROWS_INHERIT, NUMBERS_INHERIT, note) if kind == "inherit" else block(ROWS_OWN, NUMBERS_OWN, note)
    t = insert_before(s, "<h2>よくある質問</h2>", b, rel)
    if t:
        t = re.sub(r'"dateModified":"\d{4}-\d{2}-\d{2}"', '"dateModified":"2026-10-12"', t, count=1)
        wr(rel, t)

# ---------------------------------------------------------------- C. areas
AREAS = {
    "areas/hamamatsu/index.html": ("浜松市", """<div class="trust-card"><h3>空き家の相談窓口（浜松市）</h3><p>空き家全般は市民生活課（053-457-2231）。所有者向けに、司法書士・税理士・建築士・宅建士が無料で相談に応じる「空き家ワンストップ相談会」が事前申込制で開かれています（2026年度第1回は8月25日・先着16組）。<a href="https://www.city.hamamatsu.shizuoka.jp/kurashi-tetsuzuki/safety/akiya.html" rel="noopener">空き家対策（市公式）</a>／<a href="https://www.city.hamamatsu.shizuoka.jp/simink/akiya/akiyasoudan.html" rel="noopener">ワンストップ相談会</a></p></div><div class="trust-card"><h3>空き家バンクと解体補助（浜松市）</h3><p>市内全域の空き家バンク（2020年度開設、市民生活課）と、山里エリア向けの<a href="https://www.city.hamamatsu.shizuoka.jp/hamalife/eriasumai/akiyabanku.html" rel="noopener">中山間地域空き家バンク</a>（浜松移住センター 053-457-2243）があります。老朽空き家の除却は<a href="https://www.city.hamamatsu.shizuoka.jp/simink/akiya/akiyahozixyo.html" rel="noopener">解体補助金</a>（解体費の3分の1・最大50万円、事前相談が必須、先着順）。空き家の3,000万円特別控除に必要な「被相続人居住用家屋等確認書」も市が交付します。</p></div>""",
                                   "本社は磐田市見付ですが、浜松市内の物件も実家カルテの対象です。2024年1月の3区再編で旧区名が残る資料と現在の住所表記を照合するところから始めます。"),
    "areas/kakegawa/index.html": ("掛川市", """<div class="trust-card"><h3>空き家の相談窓口（掛川市）</h3><p>市役所くらしデザイン課 空き家活用係（0537-21-1209）が、適正管理と活用の両方を担当しています。市は2018年に建築士・司法書士・宅建士などで構成するNPO「かけがわランド・バンク」と協定を結び、売買・賃貸だけでなく解体・跡地活用・相続の相談も受け付けています。<a href="https://www.city.kakegawa.shizuoka.jp/gyosei/docs/8086.html" rel="noopener">掛川市の空き家対策（市公式）</a></p></div><div class="trust-card"><h3>空き家バンクと除却補助（掛川市）</h3><p>空き家バンクは、かけがわランド・バンクが運営し、契約時は宅建業者が仲介します。<a href="https://www.city.kakegawa.shizuoka.jp/gyosei/docs/600548.html" rel="noopener">空き家除却事業費補助金</a>は、昭和56年5月31日以前の木造住宅で耐震診断により倒壊のおそれがあると判断された空き家が対象（対象経費の2分の1以内・上限30万円、予算がなくなり次第終了）。<strong>除却工事の契約前</strong>に相談・申請が必要で、工事後は申請できません。</p></div>""",
                                  "本社は磐田市見付ですが、掛川市は対応地域です。2005年の合併（旧掛川市・大東町・大須賀町）前の住所表記が残る資料も、登記情報と照合して整理します。"),
    "areas/mori/index.html": ("森町", """<div class="trust-card"><h3>空き家・空き地バンク（森町）</h3><p>役場 定住推進課 移住交流係（0538-85-6321）が窓口です。登録は無料で、登録申込書・同意書・チェックリストを提出すると町が現地調査をして物件情報を公開します。町は情報提供のみで、交渉・契約は当事者同士（宅建業者に依頼する場合は法定報酬）。抵当権が付いた家や農地は登録できません。<a href="https://www.town.morimachi.shizuoka.jp/gyosei/machinososhiki/teijusuishinka/ijukoryugakari/2/2/379.html" rel="noopener">森町空き家・空き地バンク（町公式）</a></p></div><div class="trust-card"><h3>町の空き家対策計画（森町）</h3><p>2023年度から2032年度までを対象にした<a href="https://www.town.morimachi.shizuoka.jp/gyosei/machinososhiki/teijusuishinka/sumaishiengakari/2/2222.html" rel="noopener">第2期森町空家等対策計画</a>が公開されています。町内の実家は家と田畑・山林が一緒になっていることが多く、農地は農地法の許可、山林は境界の確認が売却・登録の前に必要です。</p></div>""",
                             "本社は磐田市見付ですが、森町は磐田市・袋井市と並ぶ中心対応地域です。宅地・農地・山林を分けて、売る・貸す・残す・登録するのどれが現実的かを整理します。"),
}
for rel, (city, cards, ours) in AREAS.items():
    s = rd(rel)
    if MARK2 in s:
        continue
    blk = (MARK2 + f'\n  <section class="section alt"><div class="wrap"><h2>{city}の窓口・制度を先に知っておく</h2><p>{city}には、空き家の相談や登録を受ける公的な窓口があります。売却を決める前に使えるものを並べました。当社への相談と並行して利用できます。</p><div class="trust-grid">{cards}<div class="trust-card"><h3>当社ができること</h3><p>公的窓口が扱わない「いくらで売れそうか」「残す・貸す・売るの比較」「名義・接道・境界の机上確認」を、無料の実家カルテで整理します。{ours}</p></div></div><h3 style="margin-top:28px">状況別の確認ガイド</h3><div class="topic-grid"><a class="topic-card" href="/guide/parent-care-home-house/"><b>施設入居後</b><p>親が施設に入った後、実家はどうする？</p></a><a class="topic-card" href="/guide/distant-family-home/"><b>遠方</b><p>遠方の実家・空き家はどう管理する？</p></a><a class="topic-card" href="/guide/inherited-family-home/"><b>相続</b><p>相続した実家は何から始める？</p></a><a class="topic-card" href="/guide/before-selling-family-home/"><b>売る前</b><p>実家を売る前に調べる14項目</p></a></div></div></section>')
    t = insert_before(s, f'  <section class="section"><div class="wrap"><h2>{city}の実家・空き家でよくある質問', blk, rel)
    if t:
        wr(rel, t)

print(("dry-run " if DRY else "") + f"changed {len(changed)} files")
for p in changed:
    print(" ", p)
