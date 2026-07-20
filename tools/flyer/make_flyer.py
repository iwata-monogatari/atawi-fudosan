from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
SITE_ROOT = ROOT.parents[1]
DIST = ROOT / "dist"
FONT_DIR = ROOT / "fonts"
LOGO = SITE_ROOT / "karte" / "assets" / "img" / "logo.jpg"

FLYER_URL = (
    "https://fudosan.atawi.link/kaigo-jikka/"
    "?utm_source=print&utm_medium=flyer&utm_campaign=karte_2026summer&utm_content=facility"
)
CARD_URL = (
    "https://fudosan.atawi.link/kaigo-jikka/"
    "?utm_source=print&utm_medium=card&utm_campaign=karte_2026summer&utm_content=caremanager"
)

BLUE = colors.HexColor("#0090D0")
BLUE_D = colors.HexColor("#006FA6")
BLUE_DD = colors.HexColor("#005A8C")
SUN = colors.HexColor("#F5A01E")
YELLOW = colors.HexColor("#FFD400")
SKY = colors.HexColor("#EAF6FB")
PAPER = colors.HexColor("#FBFAF6")
INK = colors.HexColor("#1A3A50")
SUB = colors.HexColor("#4D6171")
LINE = colors.HexColor("#D8E4EC")
GREEN = colors.HexColor("#3F6B56")
WHITE = colors.white


def register_fonts():
    fonts = {
        "ZenR": FONT_DIR / "ZenMaruGothic-Regular.ttf",
        "ZenM": FONT_DIR / "ZenMaruGothic-Medium.ttf",
        "ZenB": FONT_DIR / "ZenMaruGothic-Bold.ttf",
    }
    fallback = Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")
    for name, path in fonts.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
        elif fallback.exists():
            pdfmetrics.registerFont(TTFont(name, str(fallback)))
        else:
            raise FileNotFoundError(f"Japanese font not found for {name}")


def wrap_lines(text, font, size, width):
    lines = []
    for para in text.split("\n"):
        line = ""
        for ch in para:
            test = line + ch
            if pdfmetrics.stringWidth(test, font, size) <= width:
                line = test
            else:
                if line:
                    lines.append(line)
                line = ch
        if line:
            lines.append(line)
        elif para == "":
            lines.append("")
    return lines


def draw_wrapped(c, text, x, y, width, font="ZenR", size=10, leading=14, color=INK):
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap_lines(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_centered_wrapped(c, text, x, y, width, font="ZenR", size=10, leading=14, color=INK):
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap_lines(text, font, size, width):
        line_w = pdfmetrics.stringWidth(line, font, size)
        c.drawString(x + (width - line_w) / 2, y, line)
        y -= leading
    return y


def draw_logo(c, x, y, width):
    if LOGO.exists():
        img = ImageReader(str(LOGO))
        ratio = 68 / 358
        c.drawImage(img, x, y, width=width, height=width * ratio, preserveAspectRatio=True, mask="auto")
    else:
        c.setFont("ZenB", 10)
        c.setFillColor(BLUE)
        c.drawString(x, y + 3 * mm, "富士ヶ丘サービス株式会社")


def draw_qr(c, url, x, y, size, label=None):
    pad = 2.2 * mm
    c.setFillColor(WHITE)
    c.roundRect(x - pad, y - pad, size + pad * 2, size + pad * 2, 2.2 * mm, fill=1, stroke=0)
    qr = QrCodeWidget(url, barLevel="M", barBorder=4)
    qr.barWidth = size
    qr.barHeight = size
    qr.barFillColor = colors.black
    drawing = Drawing(size, size)
    drawing.add(qr)
    renderPDF.draw(drawing, c, x, y)
    if label:
        draw_centered_wrapped(c, label, x - 6 * mm, y - 5 * mm, size + 12 * mm, "ZenB", 6.8, 8, BLUE_DD)


def round_box(c, x, y, w, h, fill=WHITE, stroke=LINE, radius=3 * mm, line_width=0.7):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(line_width)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def checkbox(c, x, y, text, width, size=9.3):
    c.setStrokeColor(BLUE)
    c.setLineWidth(1)
    c.rect(x, y - 3.8 * mm, 4.4 * mm, 4.4 * mm, stroke=1, fill=0)
    c.setStrokeColor(SUN)
    c.setLineWidth(1.5)
    c.line(x + 1.2 * mm, y - 1.7 * mm, x + 2.2 * mm, y - 3.1 * mm)
    c.line(x + 2.2 * mm, y - 3.1 * mm, x + 4.1 * mm, y + .1 * mm)
    return draw_wrapped(c, text, x + 6.7 * mm, y - .5 * mm, width - 6.7 * mm, "ZenM", size, 11, INK)


def small_badge(c, text, x, y, w, h, fill=SUN, color=WHITE, size=8.6):
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, 2 * mm, fill=1, stroke=0)
    draw_centered_wrapped(c, text, x + 2 * mm, y + h - 4.4 * mm, w - 4 * mm, "ZenB", size, 9.5, color)


def draw_company_footer(c, x, y, width, size=6.8):
    text = (
        "富士ヶ丘サービス株式会社／静岡県磐田市見付5789番地1／TEL:0538-31-3308\n"
        "静岡県知事 (2) 第14083号／代表取締役・宅地建物取引士 大石 浩之（静岡県知事 第027186号）\n"
        "公益社団法人 全日本不動産協会／公益社団法人 不動産保証協会／公正取引協議会加盟事業者"
    )
    draw_centered_wrapped(c, text, x, y, width, "ZenR", size, size + 2, colors.HexColor("#66747F"))


def flyer_page(path, bleed=False):
    trim_w, trim_h = 210 * mm, 297 * mm
    bleed_size = 3 * mm if bleed else 0
    page_w, page_h = trim_w + bleed_size * 2, trim_h + bleed_size * 2
    bx, by = bleed_size, bleed_size
    top = by + trim_h
    left = bx + 13 * mm
    right = bx + trim_w - 13 * mm
    c = canvas.Canvas(str(path), pagesize=(page_w, page_h))
    c.setTitle("施設入居後のご実家相談 A4チラシ")
    c.setAuthor("富士ヶ丘サービス株式会社")

    c.setFillColor(PAPER)
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(0, page_h - (10 * mm + bleed_size), page_w, 10 * mm + bleed_size, fill=1, stroke=0)
    c.setFont("ZenB", 8.5)
    c.setFillColor(WHITE)
    c.drawCentredString(page_w / 2, page_h - 6.5 * mm, "介護×不動産の富士ヶ丘サービス｜磐田市・袋井市の実家じまい・相続空き家相談")

    draw_logo(c, left, top - 24 * mm, 50 * mm)
    c.setFillColor(BLUE_DD)
    c.setFont("ZenB", 9.5)
    c.drawRightString(right, top - 16 * mm, "電話 0538-31-3308")
    c.setFont("ZenR", 7.2)
    c.setFillColor(SUB)
    c.drawRightString(right, top - 21 * mm, "受付 9:00〜17:00")

    hero_y = top - 88 * mm
    round_box(c, left, hero_y, right - left, 56 * mm, SKY, colors.HexColor("#BBDCEA"), 4 * mm)
    c.setFillColor(BLUE_DD)
    c.setFont("ZenB", 22)
    c.drawString(left + 8 * mm, hero_y + 39 * mm, "ご入居後のご実家、")
    c.drawString(left + 8 * mm, hero_y + 29 * mm, "そのままになっていませんか。")
    draw_wrapped(
        c,
        "荷物も、名義も、これからのことも。売るかどうかを決める前に、家の「状態」を1冊に整理します。",
        left + 8 * mm,
        hero_y + 18 * mm,
        116 * mm,
        "ZenM",
        9.8,
        13,
        INK,
    )
    small_badge(c, "作成料0円", right - 54 * mm, hero_y + 34 * mm, 42 * mm, 13 * mm, SUN, WHITE, 11)
    draw_centered_wrapped(c, "8月31日まで\n標準分の実費も\n当社負担", right - 52 * mm, hero_y + 21 * mm, 38 * mm, "ZenB", 8.6, 10, BLUE_DD)
    c.setStrokeColor(SUN)
    c.setLineWidth(2)
    c.line(left + 8 * mm, hero_y + 8 * mm, right - 8 * mm, hero_y + 8 * mm)
    c.setFillColor(BLUE_DD)
    c.setFont("ZenB", 9.4)
    c.drawString(left + 8 * mm, hero_y + 3.5 * mm, "査定ではありません。売却をお勧めする案内でもありません。")

    c.setFont("ZenB", 13)
    c.setFillColor(BLUE_DD)
    c.drawString(left, top - 103 * mm, "こんな状態のまま、時間だけが過ぎていませんか。")
    check_y = top - 115 * mm
    col_w = (right - left - 10 * mm) / 2
    checks = [
        "電気や水道は止めたが、荷物はそのまま",
        "固定資産税だけ、毎年払い続けている",
        "名義が親のまま。祖父母のままかもしれない",
        "きょうだいで話す機会がなく、方針が決まらない",
        "売るとも残すとも、まだ決められない",
    ]
    for i, text in enumerate(checks):
        x = left if i % 2 == 0 else left + col_w + 10 * mm
        y = check_y - (i // 2) * 11.5 * mm
        checkbox(c, x, y, text, col_w, 8.7)

    c.setFont("ZenB", 13)
    c.setFillColor(BLUE_DD)
    c.drawString(left, top - 153 * mm, "3ステップで整理します。")
    step_y = top - 197 * mm
    step_w = (right - left - 10 * mm) / 3
    steps = [
        ("1", "住所を送る", "固定資産税通知書の写真だけでも可。入力は1分。"),
        ("2", "宅建士が机上調査", "60項目超の確認表で\n名義・道路・農地などを確認。"),
        ("3", "5営業日以内にお渡し", "PDFまたは事務所での対面説明を選べます。"),
    ]
    for i, (num, title, body) in enumerate(steps):
        x = left + i * (step_w + 5 * mm)
        round_box(c, x, step_y, step_w, 37 * mm, WHITE, LINE, 3 * mm)
        c.setFillColor(BLUE)
        c.circle(x + 7 * mm, step_y + 28 * mm, 4.4 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("ZenB", 9)
        c.drawCentredString(x + 7 * mm, step_y + 25.6 * mm, num)
        c.setFillColor(BLUE_DD)
        c.setFont("ZenB", 10)
        c.drawString(x + 14 * mm, step_y + 26 * mm, title)
        draw_wrapped(c, body, x + 7 * mm, step_y + 17 * mm, step_w - 14 * mm, "ZenR", 7.8, 9.4, SUB)

    price_y = 35 * mm + by
    c.setFont("ZenB", 12.5)
    c.setFillColor(BLUE_DD)
    c.drawString(left, price_y + 48 * mm, "料金")
    table_x, table_y, table_w, row_h = left, price_y + 10 * mm, 102 * mm, 8.6 * mm
    rows = [
        ("30分相談", "0円"),
        ("ふじがおか実家カルテ", "作成料0円"),
        ("質問", "何度でも0円"),
        ("現地確認レポート", "33,000円（税込）〜"),
        ("空き家管理", "月額5,500円（税込）〜"),
    ]
    for i, (name, value) in enumerate(rows):
        y = table_y + (len(rows) - 1 - i) * row_h
        c.setFillColor(WHITE if i % 2 else colors.HexColor("#F7FCFE"))
        c.rect(table_x, y, table_w, row_h, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.rect(table_x, y, table_w, row_h, fill=0, stroke=1)
        c.setFillColor(BLUE_DD)
        c.setFont("ZenM", 7.5)
        c.drawString(table_x + 3 * mm, y + 3 * mm, name)
        c.setFillColor(GREEN if "0円" in value else INK)
        c.setFont("ZenB", 7.5)
        c.drawRightString(table_x + table_w - 3 * mm, y + 3 * mm, value)
    draw_wrapped(c, "追加実費が必要な場合だけ、資料取得前に概算をご案内します。", left, price_y + 4 * mm, 116 * mm, "ZenR", 7.3, 8.5, SUB)

    c.setFillColor(BLUE_DD)
    c.roundRect(right - 65 * mm, by + 19 * mm, 65 * mm, 64 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("ZenB", 10)
    c.drawCentredString(right - 32.5 * mm, by + 75 * mm, "スマホで読み取り")
    draw_qr(c, FLYER_URL, right - 49 * mm, by + 33 * mm, 33 * mm, "1分で申込")
    c.setFont("ZenB", 11.5)
    c.setFillColor(WHITE)
    c.drawCentredString(right - 32.5 * mm, by + 24 * mm, "0538-31-3308")
    c.setFont("ZenR", 6.6)
    c.drawCentredString(right - 32.5 * mm, by + 20.4 * mm, "電話でのお申込みも承ります")

    draw_wrapped(
        c,
        "※査定ではないので価格は出ません。売却を迫る案内ではありません。\n※カルテのご利用有無が、ご入居や介護サービスに影響することはありません。",
        left,
        by + 19 * mm,
        108 * mm,
        "ZenR",
        6.9,
        8.4,
        SUB,
    )
    draw_company_footer(c, left, by + 10 * mm, right - left, 6.4)
    c.showPage()
    c.save()


def card_pages(path, bleed=False):
    trim_w, trim_h = 91 * mm, 55 * mm
    bleed_size = 3 * mm if bleed else 0
    page_w, page_h = trim_w + bleed_size * 2, trim_h + bleed_size * 2
    bx, by = bleed_size, bleed_size
    c = canvas.Canvas(str(path), pagesize=(page_w, page_h))
    c.setTitle("施設入居後のご実家相談 名刺カード")
    c.setAuthor("富士ヶ丘サービス株式会社")

    def front():
        c.setFillColor(WHITE)
        c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        c.setFillColor(BLUE)
        c.rect(0, page_h - (5 * mm + bleed_size), page_w, 5 * mm + bleed_size, fill=1, stroke=0)
        x, y = bx + 5 * mm, by + 5 * mm
        draw_logo(c, x, by + trim_h - 13 * mm, 34 * mm)
        small_badge(c, "作成料0円", x, by + trim_h - 22 * mm, 27 * mm, 8 * mm, SUN, WHITE, 7.8)
        c.setFillColor(BLUE_DD)
        c.setFont("ZenB", 13.8)
        c.drawString(x, by + 27 * mm, "親の家の“状態”を")
        c.drawString(x, by + 19.5 * mm, "売る前に1冊に。")
        c.setFont("ZenR", 6.9)
        c.setFillColor(SUB)
        c.drawString(x, by + 13.5 * mm, "査定ではありません。売却は迫りません。")
        c.setFillColor(BLUE_DD)
        c.setFont("ZenB", 9.5)
        c.drawString(x, by + 7.5 * mm, "TEL 0538-31-3308")
        draw_qr(c, CARD_URL, bx + trim_w - 30.5 * mm, by + 12 * mm, 22 * mm, "申込・相談")

    def back():
        c.setFillColor(PAPER)
        c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        x = bx + 6 * mm
        top = by + trim_h - 7 * mm
        c.setFillColor(BLUE_DD)
        c.setFont("ZenB", 9.8)
        c.drawString(x, top, "ふじがおか実家カルテ")
        items = [
            ("1", "住所を送る"),
            ("2", "宅建士が調査"),
            ("3", "カルテをお渡し"),
        ]
        y = top - 9 * mm
        for num, text in items:
            c.setFillColor(BLUE)
            c.circle(x + 3 * mm, y + 1.2 * mm, 3 * mm, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont("ZenB", 6.8)
            c.drawCentredString(x + 3 * mm, y - .8 * mm, num)
            c.setFillColor(INK)
            c.setFont("ZenM", 7.5)
            c.drawString(x + 9 * mm, y - .6 * mm, text)
            y -= 7.4 * mm
        c.setStrokeColor(SUN)
        c.setLineWidth(1.2)
        c.line(x, by + 18.4 * mm, bx + trim_w - 6 * mm, by + 18.4 * mm)
        draw_wrapped(c, "査定ではありません。\n売却は迫りません。\n固定資産税通知書だけでも相談可。", x, by + 15.1 * mm, 39 * mm, "ZenB", 6.7, 7.0, BLUE_DD)
        draw_wrapped(
            c,
            "富士ヶ丘サービス株式会社\n磐田市見付5789番地1／TEL 0538-31-3308\n静岡県知事 (2) 第14083号\n宅地建物取引士 大石浩之",
            bx + 51 * mm,
            by + 15.4 * mm,
            35 * mm,
            "ZenR",
            4.9,
            5.7,
            SUB,
        )

    front()
    c.showPage()
    back()
    c.showPage()
    c.save()


def main():
    register_fonts()
    DIST.mkdir(parents=True, exist_ok=True)
    outputs = [
        DIST / "kaigo-jikka-flyer-a4.pdf",
        DIST / "kaigo-jikka-flyer-a4-bleed.pdf",
        DIST / "kaigo-jikka-card.pdf",
        DIST / "kaigo-jikka-card-bleed.pdf",
    ]
    flyer_page(outputs[0], bleed=False)
    flyer_page(outputs[1], bleed=True)
    card_pages(outputs[2], bleed=False)
    card_pages(outputs[3], bleed=True)
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
