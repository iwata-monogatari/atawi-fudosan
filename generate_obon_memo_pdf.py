from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "karte" / "downloads" / "obon-family-meeting-memo.pdf"


def draw_wrapped(c, text, x, y, width, font="HeiseiKakuGo-W5", size=10.5, leading=15, color=colors.HexColor("#1A3A50")):
    c.setFont(font, size)
    c.setFillColor(color)
    line = ""
    for ch in text:
        test = line + ch
        if pdfmetrics.stringWidth(test, font, size) <= width:
            line = test
        else:
            c.drawString(x, y, line)
            y -= leading
            line = ch
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def check_item(c, x, y, label, note):
    c.setStrokeColor(colors.HexColor("#0072B0"))
    c.setLineWidth(1)
    c.rect(x, y - 4, 4.5 * mm, 4.5 * mm, stroke=1, fill=0)
    c.setFont("HeiseiKakuGo-W5", 11.5)
    c.setFillColor(colors.HexColor("#005A8C"))
    c.drawString(x + 7 * mm, y - 1, label)
    return draw_wrapped(c, note, x + 7 * mm, y - 15, 70 * mm, size=9.2, leading=12)


def main():
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiMin-W3"))
    OUT.parent.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(OUT), pagesize=A4)
    w, h = A4
    margin = 16 * mm

    c.setFillColor(colors.HexColor("#EAF6FB"))
    c.rect(0, h - 52 * mm, w, 52 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#0072B0"))
    c.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("HeiseiKakuGo-W5", 10)
    c.drawCentredString(w / 2, h - 8 * mm, "ふじがおか実家カルテ｜お盆前の家族会議で使う確認メモ")

    c.setFillColor(colors.HexColor("#005A8C"))
    c.setFont("HeiseiKakuGo-W5", 21)
    c.drawString(margin, h - 27 * mm, "お盆の家族会議メモ")
    c.setFont("HeiseiMin-W3", 10.5)
    c.setFillColor(colors.HexColor("#1A3A50"))
    c.drawString(margin, h - 36 * mm, "親の家・相続した家・空き家について、売るかどうかを決める前に確認しておきたいこと。")
    c.setFont("HeiseiKakuGo-W5", 9.5)
    c.setFillColor(colors.HexColor("#F5A01E"))
    c.drawString(margin, h - 44 * mm, "8月5日（水）までのお申込み分は、お盆前にカルテをお渡しできます。")

    y = h - 62 * mm
    c.setFillColor(colors.HexColor("#005A8C"))
    c.setFont("HeiseiKakuGo-W5", 13.5)
    c.drawString(margin, y, "家族で確認する6項目")

    y -= 10 * mm
    col_w = 86 * mm
    left_x = margin
    right_x = margin + col_w + 8 * mm
    row_y = y
    left_items = [
        ("名義は誰か", "登記上の所有者は親本人か、亡くなった方の名義か、共有名義か。"),
        ("相続登記は済んでいるか", "相続登記が未了なら、売却や活用の前に誰が相続人かを整理します。"),
        ("ローンや抵当権は残っていないか", "住宅ローン、抵当権、差押え、仮登記などの記載がないか。"),
    ]
    right_items = [
        ("農地・山林・私道はないか", "地目や道路、農地法、私道負担など、売却前に確認が必要な項目。"),
        ("誰が管理するか", "草刈り、郵便物、近隣対応、火災保険、鍵の所在を決めておきます。"),
        ("売る・残す・貸すの意向", "全員の本音を一度に決めず、まず選択肢と保留理由を書き出します。"),
    ]
    for i, item in enumerate(left_items):
        y2 = check_item(c, left_x, row_y - i * 34 * mm, item[0], item[1])
        c.setStrokeColor(colors.HexColor("#D8E4EC"))
        c.line(left_x + 7 * mm, y2 + 2, left_x + col_w, y2 + 2)
    for i, item in enumerate(right_items):
        y2 = check_item(c, right_x, row_y - i * 34 * mm, item[0], item[1])
        c.setStrokeColor(colors.HexColor("#D8E4EC"))
        c.line(right_x + 7 * mm, y2 + 2, right_x + col_w, y2 + 2)

    y = h - 177 * mm
    c.setFillColor(colors.HexColor("#FBFAF6"))
    c.roundRect(margin, y - 35 * mm, w - margin * 2, 38 * mm, 4, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#005A8C"))
    c.setFont("HeiseiKakuGo-W5", 12.5)
    c.drawString(margin + 6 * mm, y - 7 * mm, "今日のメモ")
    c.setStrokeColor(colors.HexColor("#D8E4EC"))
    for i in range(3):
        ly = y - 16 * mm - i * 8 * mm
        c.line(margin + 6 * mm, ly, w - margin - 6 * mm, ly)

    y = h - 224 * mm
    c.setFillColor(colors.HexColor("#0072B0"))
    c.roundRect(margin, y - 38 * mm, w - margin * 2, 42 * mm, 5, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("HeiseiKakuGo-W5", 14)
    c.drawString(margin + 7 * mm, y - 8 * mm, "住所から、親の家の状態を1冊に整理します。")
    c.setFont("HeiseiKakuGo-W5", 9.8)
    c.drawString(margin + 7 * mm, y - 18 * mm, "ふじがおか実家カルテ｜作成料0円・登記簿や公図などの資料取得実費（1,000円前後）のみ")
    c.drawString(margin + 7 * mm, y - 27 * mm, "この時点では売却依頼にはなりません。概算実費をご案内し、承諾後に調査します。")
    c.setFont("HeiseiKakuGo-W5", 10.5)
    c.drawRightString(w - margin - 7 * mm, y - 35 * mm, "https://fudosan.atawi.link/karte/  TEL 0538-31-3308")

    c.setFont("HeiseiKakuGo-W5", 8.5)
    c.setFillColor(colors.HexColor("#5A7080"))
    c.drawString(margin, 12 * mm, "運営：富士ヶ丘サービス株式会社（静岡県磐田市見付5789番地1／宅建業免許 静岡県知事 (2) 第14083号）")
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
