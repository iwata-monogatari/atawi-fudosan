#!/usr/bin/env python3
"""2026-10-12 AI検索ベースラインで分かった3つの穴を埋める（冪等・マーカー付き）。

  1. /results/ と /about/oishi/ に沿革・公開実績・第三者掲載を追記（出典と日付つき。正本表にない数字は入れない）
  2. 施設入居後・遠方管理の4記事に「判断基準の表」と制度の数字（空き家特例の3年・固定資産税の住宅用地特例）
  3. /areas/fukuroi/ に袋井市の窓口・制度リンクと袋井の記事・事例

使い方: python -X utf8 _tools/add-authority-content-20261012.py [--dry-run]
施設入居ガイドの税説明だけを同期: --parent-care-tax-only（他ページは処理しない）
施設入居記事の比較表だけを同期: --jikka-parent-table-only（想定外の表編集は拒否）
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DRY = "--dry-run" in sys.argv
JIKKA_TABLE_ONLY = "--jikka-parent-table-only" in sys.argv
JIKKA_TAX_ONLY = "--jikka-parent-tax-only" in sys.argv or JIKKA_TABLE_ONLY
PARENT_TAX_ONLY = "--parent-care-tax-only" in sys.argv or JIKKA_TAX_ONLY
MARK = "<!-- authority-20261012 -->"
changed = []


def rd(p):
    return open(os.path.join(ROOT, p), "rb").read().decode("utf-8")


def wr(p, s):
    changed.append(p)
    if not DRY:
        open(os.path.join(ROOT, p), "wb").write(s.encode("utf-8"))


def nl_of(s):
    return "\r\n" if "\r\n" in s else "\n"


def insert_before(s, anchor, block, rel):
    i = s.find(anchor)
    if i < 0:
        print("anchor not found:", rel, anchor[:40])
        return s
    return s[:i] + block + nl_of(s) + s[i:]


def title_of(rel):
    s = rd(rel)
    m = re.search(r'<meta property="og:title" content="([^"]*)"', s) or re.search(r"<title>([^<|｜]*)", s)
    return re.sub(r"｜.*$", "", m.group(1)).strip() if m else rel


# ---------------------------------------------------------------- 1. results / about
RESULTS_BLOCK = MARK + """
<section class="fact"><h2>沿革</h2><dl><dt>2011年3月</dt><dd>高齢者福祉事業で創業（静岡県磐田市）</dd><dt>2012年5月</dt><dd>サービス付き高齢者向け住宅の運営を開始。現在は市内3棟（見付連理枝／和楽久磐田合代島／おおるりメゾンド安久路）、併設で訪問介護・通所介護・居宅介護支援</dd><dt>2018年5月</dt><dd>不動産事業を開始（宅地建物取引業 静岡県知事 (2) 第14083号）。介護事業者の立場で、施設入居後の実家・相続した空き家の相談を受ける</dd><dt>2026年</dt><dd>ふじがおか実家カルテ（本サイト）で、売却前提なしの状態整理を無料で提供</dd></dl><p class="fine">会社概要の正本は <a href="https://www.fujigaoka-service.co.jp/company/" rel="noopener">富士ヶ丘サービス株式会社 会社概要（公式）</a>。代表者のプロフィールは <a href="/about/oishi/">大石浩之について</a> と <a href="https://oishi-hiroyuki.org/profile" rel="noopener">oishi-hiroyuki.org</a>。</p></section>
<section class="fact"><h2>公開されている取引実績</h2><dl><dt>2025年1〜12月（契約ベース）</dt><dd>契約締結 27件。中古住宅が18件で最多、ほかに土地・倉庫・マンション。価格帯は1,000万円以下が中心。両手取引が大半（出典：<a href="https://www.fujigaoka-service.co.jp/blog/entry-708971/" rel="noopener">2025年契約ベース不動産取引実績</a>、2025年12月11日公開。両手取引の考え方は<a href="/column/ryote/">コラム</a>に記載）</dd><dt>2018年5月の事業開始以降</dt><dd>売却 45件（戸建29・土地13・マンション3）、買取 4件（出典：イクラ不動産 加盟店ページ。集計期間は確認中のため、確認でき次第ここに併記します）</dd></dl><p class="fine">件数は対象期間・集計基準が公開されているものだけを載せています。実家カルテの作成件数は集計基準を定めてから公開します。</p></section>
<section class="fact"><h2>第三者サイトでの掲載・評価（2026年10月12日時点）</h2><dl><dt>Google ビジネスプロフィール</dt><dd>口コミ 53件・評価 4.7（<a href="https://share.google/JvfsXQE82HymM6k8k" rel="noopener">Google マップで見る</a>）</dd><dt>LIFULL HOME'S</dt><dd><a href="https://www.homes.co.jp/realtor/mid-144301hQA24Pw1v0pM/" rel="noopener">会社ページ</a>（磐田市の不動産売却・査定の掲載会社）</dd><dt>イクラ不動産</dt><dd><a href="https://iqrafudosan.com/companies/7405" rel="noopener">加盟店ページ</a>（売却実績の出典）</dd><dt>所属団体</dt><dd>公益社団法人 全日本不動産協会／公益社団法人 不動産保証協会／公正取引協議会加盟事業者</dd></dl><p class="fine">新聞・テレビ等の取材歴は、確認できる記事が公開され次第、媒体名と日付を添えて追記します。</p></section>
"""

ABOUT_BLOCK = MARK + """
<section style="max-width:900px;margin:40px auto;padding:0 20px"><h2>法人の沿革と、確認できる実績</h2><dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 18px;font-size:15px;line-height:1.7"><dt>2011年3月</dt><dd>富士ヶ丘サービス株式会社を高齢者福祉事業で創業</dd><dt>2012年5月</dt><dd>サービス付き高齢者向け住宅の運営開始（現在 磐田市内3棟）</dd><dt>2018年5月</dt><dd>不動産事業開始。宅地建物取引士として売却・相続・空き家の相談を直接担当</dd><dt>2025年</dt><dd>契約ベースで27件の不動産取引を担当（<a href="https://www.fujigaoka-service.co.jp/blog/entry-708971/" rel="noopener">公開報告</a>）</dd></dl><p style="font-size:14px;color:#556">免許・所属・実績の一覧は <a href="/results/">公開している実績と運営情報</a> にまとめています。</p></section>
"""

rel = "results/index.html"
if not PARENT_TAX_ONLY:
    s = rd(rel)
    if MARK not in s:
        s = insert_before(s, '<div class="policy">', RESULTS_BLOCK, rel)
        wr(rel, s)

rel = "about/oishi/index.html"
if not PARENT_TAX_ONLY:
    s = rd(rel)
    if MARK not in s:
        s = insert_before(s, "</main>", ABOUT_BLOCK, rel)
        wr(rel, s)

# ---------------------------------------------------------------- 2. 判断基準の表 + 数字
ROWS = [
    ("将来、誰かが住む・使う予定", "ある（Uターン、親族が使う、戻る可能性を残す）", "当面ない。建物を傷ませずに持ち続けたい", "ない。家族の誰も使う見込みがない"),
    ("年間の負担", "固定資産税・保険・通水・草刈り・見回りを自分たちで払い続けられる", "家賃収入で税・修繕費をまかなえる見込みがある", "負担そのものをなくしたい"),
    ("現地へ通えるか", "通える、または管理サービスに委託できる", "管理会社に任せられる", "通えない。遠方からの対応が精神的に負担"),
    ("建物の状態", "今のまま使える", "貸せる状態に直す費用を出せる", "修繕・解体の判断を買主に委ねたい"),
    ("税の期限", "急いで現金化する必要がない", "貸すと空き家の3,000万円特別控除は使えなくなる", "相続開始の日から3年を経過する日の属する年の12月31日までの売却が要件。他の要件も確認"),
]


PARENT_TAX_RENT = "相続した空き家の特例では、相続後の貸付けなど利用状況の要件があります。親が存命中に以前の自宅を売る場合の特例とは異なります。"
PARENT_TAX_SELL = "相続した空き家の特例は、相続開始の日から3年を経過する日の属する年の12月31日までの売却が要件。制度の適用期間・他の要件も確認"
PARENT_TAX_NOTE = '<p class="fine" data-parent-sale-tax="20261020">親ご本人が売主になる場合は、<a href="/guide/senior-relocation/">老後の住み替えガイドの税の確認事項</a>へ。退去後に家屋を貸したことだけで、本人の居住用財産の特例から外れるわけではありません。売却期限、家屋を取り壊した場合、売却相手などの要件と確定申告を確認してください。相続した空き家の特例とは別制度です。個別の適用は税務署・税理士へご確認ください（<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3302.htm" rel="noopener">国税庁 No.3302</a>／<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3306.htm" rel="noopener">No.3306</a>、確認日：2026年10月20日）。</p>'


def parent_tax_guidance(source):
    old_row = '<tr><th>税の期限</th>' + ''.join(f'<td>{x}</td>' for x in ROWS[-1][1:]) + '</tr>'
    new_row = f'<tr><th>税の期限・適用条件</th><td>{ROWS[-1][1]}</td><td>{PARENT_TAX_RENT}</td><td>{PARENT_TAX_SELL}</td></tr>'
    if old_row in source:
        if source.count(old_row) != 1:
            raise ValueError('parent care tax row is duplicated')
        source = source.replace(old_row, new_row, 1)
    elif source.count(new_row) != 1:
        raise ValueError('parent care tax row has unrecognized edits')
    if 'data-parent-sale-tax=' not in source:
        anchor = '</tbody></table></div><h3>数字で確認しておくこと</h3>'
        if source.count(anchor) != 1:
            raise ValueError('parent care tax note anchor is missing or duplicated')
        source = source.replace(anchor, '</tbody></table></div>' + PARENT_TAX_NOTE + '<h3>数字で確認しておくこと</h3>', 1)
    elif source.count(PARENT_TAX_NOTE) != 1:
        raise ValueError('parent care tax note has unrecognized edits')
    return source


def decision_table_guide(city_note, parent_care=False):
    head = "<thead><tr><th>判断のポイント</th><th>残す（管理する）</th><th>貸す</th><th>売る</th></tr></thead>"
    body = "".join(f"<tr><th>{a}</th><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in ROWS)
    block = (MARK + f'<h3>判断基準の表：残す・貸す・売るを同じ軸で比べる</h3><div class="table-wrap"><table>{head}<tbody>{body}</tbody></table></div>'
             + NUMBERS.replace("{{CITY}}", city_note))
    return parent_tax_guidance(block) if parent_care else block


NUMBERS = """<h3>数字で確認しておくこと</h3><ul>
<li><strong>固定資産税の住宅用地特例</strong>：住宅用地の特例は、固定資産税の<strong>課税標準</strong>を住宅1戸あたり200㎡まで評価額の6分の1、それを超える対象部分を3分の1にするものです（家屋の床面積の10倍までなどの条件があります）。解体や管理不全空家等・特定空家等への勧告で対象から外れることがありますが、軽減率だけから税額が一律6倍になるとは計算できません。土地の条件・負担調整・減額措置を含め、市町の資産税窓口へ確認してください（<a href="https://www.city.iwata.shizuoka.jp/kurashi_tetsuzuki/zeikin/koteishisan_toshikeikakuzei/1001410/1001411.html" rel="noopener">磐田市：住宅用地に対する特例</a>／<a href="https://www.city.iwata.shizuoka.jp/kurashi_tetsuzuki/zeikin/koteishisan_toshikeikakuzei/1001410/1001418.html" rel="noopener">空き家解体に係る減額措置</a>、確認日：2026年10月13日）。{{CITY}}</li>
<li><strong>空き家の3,000万円特別控除（被相続人の居住用財産）</strong>：相続した家を売るとき、譲渡所得から最高3,000万円を控除できる制度です。期限は<strong>相続開始の日から3年を経過する日の属する年の12月31日まで</strong>で、2027年12月31日までの売却が対象です。昭和56年5月31日以前に建てられた家で、亡くなった方が一人で住んでいたこと、売却額が1億円以下であることなどの要件があり、相続から売却等までの貸付け・事業・居住利用の有無も確認します。老人ホーム等への入居には別の要件があり、親が存命中に本人の自宅を売る場合の特例とは区別してください。相続・遺贈でこの家屋と敷地等を取得した相続人が3人以上の場合、2024年1月1日以後の譲渡では1人当たりの控除上限が2,000万円になります（<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3306.htm" rel="noopener">国税庁 No.3306</a>）。</li>
<li><strong>相続登記の義務化</strong>：2024年4月1日から、相続で不動産を取得したことを知った日から<strong>3年以内</strong>の登記申請が義務です。正当な理由なく怠ると10万円以下の過料の対象になります（<a href="https://www.moj.go.jp/MINJI/minji05_00435.html" rel="noopener">法務省</a>）。売る・貸すのどちらを選んでも、名義が亡くなった方のままでは契約に進めません。</li>
</ul><p class="fine">税額・控除の可否は土地ごと・家族ごとに異なります。金額の確定は市の資産税窓口と税理士に、登記は司法書士にご確認ください。実家カルテでは、これらの要件に関係する「建築年」「名義」「相続開始日」「接道」を先に整理します。</p>"""

GUIDE_PAGES = {
    "guide/parent-care-home-house/index.html": (
        "<h2>5. 売る・貸す・残すの費用を比較</h2><p>固定資産税、管理費、修繕費、解体費を把握します。価格査定の前に、接道、境界、農地、未登記建物など売却の支障を確認すると判断しやすくなります。</p>",
        "施設に入居した親御さんの家は、本人が住んでいなくても「住宅用地」として扱われるのが通常ですが、勧告を受けるほど管理が行き届かなくなると特例が外れます。"),
    "guide/distant-family-home/index.html": (
        "<h2>5. 管理を続ける期間と費用を決める</h2><p>固定資産税、保険、通水、草刈り、見回り費用を把握し、売る・残す・貸すを検討する期限を家族で共有します。</p>",
        "遠方から通う交通費と時間も、年間の負担に入れて比べてください。"),
}
for rel, (anchor, city_note) in GUIDE_PAGES.items():
    parent_care = rel == 'guide/parent-care-home-house/index.html'
    if JIKKA_TAX_ONLY or (PARENT_TAX_ONLY and not parent_care):
        continue
    s = rd(rel)
    if MARK in s:
        if parent_care:
            updated = parent_tax_guidance(s)
            if updated != s:
                updated = re.sub(r'("dateModified"\s*:\s*")[^"]+', r'\g<1>2026-10-20', updated)
                wr(rel, updated)
        continue
    i = s.find(anchor)
    if i < 0:
        print("anchor not found:", rel)
        continue
    j = i + len(anchor)
    s = s[:j] + decision_table_guide(city_note, parent_care) + s[j:]
    if parent_care:
        s = re.sub(r'("dateModified"\s*:\s*")[^"]+', r'\g<1>2026-10-20', s)
    wr(rel, s)

# 施設入居後の記事だけを対象とする。想定外の編集は上書きしない。
JIKKA_TAX_RENT = "相続した空き家の特例では、相続後の貸付けなど利用状況を確認します。親が存命中に以前の自宅を売る場合の特例とは別です。"
JIKKA_TAX_SELL = "相続した空き家の特例は、相続開始の日から3年を経過する日の属する年の12月31日までの売却が要件。制度の適用期間・他の要件も確認"
JIKKA_TAX_NOTE = '<p class="fine" data-jikka-parent-tax="20261028">親ご本人が売主になる場合は、<a href="/guide/senior-relocation/">老後の住み替えガイドの税の確認事項</a>へ。退去後に家屋を貸したことだけで、本人の居住用財産の特例から外れるわけではありません。売却期限、解体後の敷地、売却相手などの要件と確定申告を確認してください。相続した空き家の特例とは別制度です。個別の適用は税務署・税理士へご確認ください（<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3302.htm" rel="noopener">国税庁 No.3302</a>／<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3306.htm" rel="noopener">No.3306</a>、確認日：2026年10月28日）。</p>'

def jikka_parent_tax_guidance(source):
    if care_comparison_table() in source:
        if source.count(care_comparison_table()) != 1 or source.count(JIKKA_TAX_NOTE) != 1:
            raise ValueError('jikka comparison table or tax note is duplicated')
        return source
    a, b, c, d = ROWS[-1]
    old = f'<div><b>{a}</b><span>残す：{b}<br>貸す：{c}<br>売る：{d}</span></div>'
    new = f'<div><b>税の期限・適用条件</b><span>残す：{b}<br>貸す：{JIKKA_TAX_RENT}<br>売る：{JIKKA_TAX_SELL}</span></div>'
    if source.count(old) == 1 and 'data-jikka-parent-tax=' not in source:
        source = source.replace(old, new, 1)
        anchor = '</span></div></table><h2>数字で確認しておくこと</h2>'
        if source.count(anchor) != 1:
            raise ValueError('jikka tax note anchor is missing or duplicated')
        source = source.replace(anchor, '</span></div></table>' + JIKKA_TAX_NOTE + '<h2>数字で確認しておくこと</h2>', 1)
        source = source.replace('"dateModified":"2026-10-13"', '"dateModified":"2026-10-28"', 1)
        source = source.replace('<time datetime="2026-10-13">2026年10月13日</time>', '<time datetime="2026-10-28">2026年10月28日</time>', 1)
    elif source.count(new) != 1 or source.count(JIKKA_TAX_NOTE) != 1 or source.count(old):
        raise ValueError('jikka parent tax row or note has unrecognized edits')
    return source

def care_comparison_rows():
    return ROWS[:-1] + [("税の期限・適用条件", ROWS[-1][1], JIKKA_TAX_RENT, JIKKA_TAX_SELL)]


CARE_CSS = '<link rel="stylesheet" href="/jikka/assets/care-comparison.css?v=20261029">'


def care_comparison_table():
    rows = ''.join(f'<tr><th scope="row">{a}</th><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in care_comparison_rows())
    return '<div class="care-comparison-scroll" role="region" aria-label="残す・貸す・売るの比較表（横にスクロールできます）" tabindex="0"><table class="care-comparison"><caption>残す・貸す・売るの比較</caption><thead><tr><th scope="col">判断の軸</th><th scope="col">残す</th><th scope="col">貸す</th><th scope="col">売る</th></tr></thead><tbody>' + rows + '</tbody></table></div>'


def jikka_comparison_structure(source):
    old = '<table class="info-table">' + ''.join(f'<div><b>{a}</b><span>残す：{b}<br>貸す：{c}<br>売る：{d}</span></div>' for a, b, c, d in care_comparison_rows()) + '</table>'
    new = care_comparison_table()
    if source.count(JIKKA_TAX_NOTE) != 1:
        raise ValueError('jikka tax note has unrecognized edits')
    if source.count(old) == 1 and new not in source:
        source = source.replace(old, new, 1)
    elif source.count(new) != 1 or old in source:
        raise ValueError('jikka comparison table has unrecognized edits')
    if '</head>' in source:
        if CARE_CSS not in source:
            source = source.replace('</head>', CARE_CSS + '\n</head>', 1)
        elif source.count(CARE_CSS) != 1:
            raise ValueError('jikka comparison stylesheet is duplicated')
        source = source.replace('"dateModified":"2026-10-28"', '"dateModified":"2026-10-29"', 1)
        source = source.replace('<time datetime="2026-10-28">2026年10月28日</time>', '<time datetime="2026-10-29">2026年10月29日</time>', 1)
    return source


# 遠方管理の既存出力は保持し、施設入居記事だけ正しい表構造へ同期する。
def decision_table_jikka(city_note):
    rows = "".join(f"<div><b>{a}</b><span>残す：{b}<br>貸す：{c}<br>売る：{d}</span></div>" for a, b, c, d in ROWS)
    return MARK + f'<h2>判断基準の表：残す・貸す・売るを同じ軸で比べる</h2><table class="info-table">{rows}</table>' + NUMBERS.replace("{{CITY}}", city_note).replace("<h3>", "<h2>").replace("</h3>", "</h2>")


JIKKA_PAGES = {
    "jikka/articles/after-care-facility.html": "施設に入居した親御さんの家は、本人が住んでいなくても「住宅用地」として扱われるのが通常ですが、勧告を受けるほど管理が行き届かなくなると特例が外れます。",
    "jikka/articles/faraway-management.html": "遠方から通う交通費と時間も、年間の負担に入れて比べてください。",
}
for rel, city_note in JIKKA_PAGES.items():
    target = rel == "jikka/articles/after-care-facility.html"
    if PARENT_TAX_ONLY and not (JIKKA_TAX_ONLY and target):
        continue
    s = rd(rel)
    if MARK in s:
        if JIKKA_TAX_ONLY and target:
            updated = jikka_comparison_structure(jikka_parent_tax_guidance(s))
            if updated != s:
                wr(rel, updated)
        continue
    if JIKKA_TAX_ONLY:
        raise ValueError('jikka authority marker is missing')
    block = decision_table_jikka(city_note)
    if target:
        block = jikka_comparison_structure(jikka_parent_tax_guidance(block))
    s = insert_before(s, '<section class="article-faq">', block, rel)
    if target:
        s = jikka_comparison_structure(s)
    wr(rel, s)

# ---------------------------------------------------------------- 3. 袋井
FUKUROI_BLOG = [
    "blog/20260820-fukuroi-jokyaku-hojo/index.html",
    "blog/20261001-fukuroi-kanmin-kyokai-shinsei/index.html",
    "blog/20260903-fukuroi-fudosan-gis-4items/index.html",
    "blog/20260909-fukuroi-shiyuchi-nyusatsu/index.html",
    "blog/20260828-fukuroi-jinko-setaisu-2026/index.html",
]
blog_links = "".join(
    f'<li><a href="/{os.path.dirname(p)}/">{title_of(p)}</a></li>' for p in FUKUROI_BLOG if os.path.exists(os.path.join(ROOT, p))
)
FUKUROI_BLOCK = MARK + f"""
  <section class="section alt"><div class="wrap"><h2>袋井市の窓口・制度を先に知っておく</h2><p>袋井市には、空き家と相続の相談を受ける市の窓口があります。売却を決める前に使えるものを並べました。当社への相談と並行して利用できます。</p><div class="trust-grid"><div class="trust-card"><h3>ふくろいすまいの相談センター（袋井市）</h3><p>2020年4月に旧中村洋裁学院（袋井市袋井260番地の1）に開設された市の窓口。空き家の見守り管理・流動化・解体・相続相談・リフォームの5業務を扱い、相続は静岡県司法書士会と連携しています。開館は火・水・木・土 8:30〜17:15、TEL 0538-44-3321。<a href="https://www.city.fukuroi.shizuoka.jp/soshiki/53/sumainosoudann/1587015221464.html" rel="noopener">市の案内ページ</a>／<a href="https://www.city.fukuroi.shizuoka.jp/soshiki/53/sumainosoudann/14613.html" rel="noopener">空家等相続相談業務</a></p></div><div class="trust-card"><h3>空き家の支援制度（袋井市）</h3><p>除却・跡地利用などの補助は、対象地区（防災上の危険度評価）や跡地の用途に条件があります。売却前提の解体に使える制度と使えない制度があるので、申請の前に要件を確認してください。<a href="https://www.city.fukuroi.shizuoka.jp/soshiki/53/sumainosoudann/324/1587967767606.html" rel="noopener">市の支援制度一覧</a></p></div><div class="trust-card"><h3>当社ができること</h3><p>市の窓口が扱わない「いくらで売れそうか」「残す・貸す・売るの比較」「名義・接道・境界の机上確認」を、袋井市内の物件について無料の実家カルテで整理します。本社は磐田市見付ですが、袋井市は中心対応地域です。</p></div></div><h3 style="margin-top:28px">袋井市について書いた記事</h3><ul class="check-list">{blog_links}</ul><h3 style="margin-top:28px">袋井市の相談で多い状況に近い事例</h3><div class="topic-grid"><a class="topic-card" href="/karte/cases/parent-entered-care-home/"><b>施設入居後</b><p>親が施設へ入り、誰も住まなくなった実家</p></a><a class="topic-card" href="/karte/cases/vacant-house-special-deduction/"><b>税金</b><p>空き家の譲渡所得特例が使えるか確認した</p></a><a class="topic-card" href="/areas/fukuroi/akiya-bank-mae/"><b>空き家バンク</b><p>袋井市の空き家バンクに出す前に、売却と比べる確認順</p></a><a class="topic-card" href="/areas/fukuroi/koteishisanzei/"><b>固定資産税</b><p>通知書だけで始める確認順</p></a></div></div></section>
"""
rel = "areas/fukuroi/index.html"
if not PARENT_TAX_ONLY:
    s = rd(rel)
    if MARK not in s:
        s = insert_before(s, '  <section class="section"><div class="wrap"><h2>袋井市の実家・空き家でよくある質問', FUKUROI_BLOCK, rel)
        wr(rel, s)

print(("dry-run " if DRY else "") + f"changed {len(changed)} files")
for p in changed:
    print(" ", p)
